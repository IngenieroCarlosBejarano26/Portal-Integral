import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment.local';
import { ApiResponse } from '../base-api.service';

/** Datos que el frontend envia al backend para iniciar un pago Wompi. */
export interface IniciarPagoWompiDto {
  planSolicitadoId: string;
  precioUSD: number;
  tasaCambio: number;
  montoCOP: number;
}

/** Respuesta del backend lista para inicializar el widget de Wompi. */
export interface IniciarPagoWompiResponse {
  solicitudId: string;
  publicKey: string;
  reference: string;
  amountInCents: number;
  currency: string;
  signatureIntegrity: string;
  redirectUrl?: string;
  sandbox: boolean;
}

/** Estado de un pago Wompi (resultado del polling). */
export interface EstadoPagoWompi {
  solicitudId: string;
  tenantId: string;
  tenantNombre?: string;
  planSolicitadoId: string;
  planNombre?: string;
  montoCOP: number;
  precioUSD: number;
  tasaCambio: number;
  wompiReference: string;
  wompiTransactionId?: string;
  /** Estado normalizado de la pasarela: PENDING | APPROVED | DECLINED | VOIDED | ERROR. */
  wompiStatus?: string;
  /** Estado interno de la solicitud: Pendiente | Aprobado | Rechazado. */
  estado: 'Pendiente' | 'Aprobado' | 'Rechazado';
  motivoRechazo?: string;
  usuarioSolicitante: string;
  fechaSolicitud: string;
  usuarioRevisor?: string;
  fechaRevision?: string;
}

/** Resultado de cerrar el widget de Wompi (transactionId puede no estar). */
export interface WompiWidgetResult {
  transaction?: { id?: string; reference?: string; status?: string };
}

declare global {
  interface Window {
    /** Inyectado por checkout.wompi.co/widget.js. */
    WidgetCheckout?: any;
  }
}

const WIDGET_SRC = 'https://checkout.wompi.co/widget.js';

/** Espera a que el script de Wompi exponga `WidgetCheckout` (p. ej. tag ya cargado antes). */
function pollWidgetReady(maxMs: number, intervalMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = (): void => {
      if (window.WidgetCheckout) {
        resolve();
        return;
      }
      if (Date.now() - start >= maxMs) {
        reject(
          new Error(
            'El script de Wompi cargo pero no expone WidgetCheckout. Comprueba bloqueos (adblock), red o que https://checkout.wompi.co este accesible.'
          )
        );
        return;
      }
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

/**
 * Servicio cliente para Wompi. Encapsula:
 *  - Llamadas al backend (`/iniciar`, `/estado`).
 *  - Carga lazy del widget de Wompi (1 sola vez).
 *  - Apertura del widget y resolucion del resultado del usuario.
 *
 * Filosofia: NUNCA confiamos en el resultado del widget para activar el plan;
 * la fuente de verdad es el webhook firmado en el backend. El widget solo nos
 * da feedback visual al usuario.
 */
@Injectable({ providedIn: 'root' })
export class WompiService {
  private http = inject(HttpClient);
  private base = environment.api!.baseUrl + '/api/pagos-wompi';
  /** Promesa de carga del script; se limpia si falla para permitir reintentar. */
  private widgetScriptPromise: Promise<void> | null = null;

  /** Crea la solicitud y devuelve los parametros firmados para el widget. */
  iniciar(dto: IniciarPagoWompiDto): Observable<ApiResponse<IniciarPagoWompiResponse>> {
    return this.http.post<ApiResponse<IniciarPagoWompiResponse>>(`${this.base}/iniciar`, dto);
  }

  /** Polling: consulta el estado actual de un pago por su reference. */
  consultarEstado(reference: string): Observable<EstadoPagoWompi | null> {
    return this.http
      .get<ApiResponse<EstadoPagoWompi>>(`${this.base}/estado/${encodeURIComponent(reference)}`)
      .pipe(map(r => r?.data ?? null));
  }

  /** Lista los pagos Wompi del tenant logueado (historial de la pestaña Pagos en línea). */
  listarMisPagos(): Observable<EstadoPagoWompi[]> {
    return this.http
      .get<ApiResponse<EstadoPagoWompi[]>>(`${this.base}/mis-pagos`)
      .pipe(map(r => r?.data ?? []));
  }

  /**
   * Carga el script del widget si no esta cargado y abre el checkout.
   * Resuelve cuando el usuario cierra el widget (con o sin pago).
   */
  async lanzarWidget(data: IniciarPagoWompiResponse): Promise<WompiWidgetResult> {
    const publicKey = String(data.publicKey ?? '').trim();
    const reference = String(data.reference ?? '').trim();
    const sig = String(data.signatureIntegrity ?? '').trim();
    const amountInCents = Math.round(Number(data.amountInCents));

    if (!publicKey) {
      throw new Error(
        'Falta la clave publica de Wompi. Revisa en Azure (o appsettings) Wompi:PublicKey y que coincida con sandbox o produccion.'
      );
    }
    if (!reference) {
      throw new Error('Respuesta del servidor incompleta: falta la referencia del pago.');
    }
    if (!sig) {
      throw new Error(
        'Falta la firma de integridad. Revisa Wompi:IntegritySecret en el servidor (debe ser el secreto del panel de Wompi, no la llave privada).'
      );
    }
    if (!Number.isFinite(amountInCents) || amountInCents < 1) {
      throw new Error('Monto del pago invalido. Actualiza la pagina e intenta de nuevo.');
    }

    await this.cargarWidgetScript();

    if (!window.WidgetCheckout) {
      throw new Error('El widget de Wompi no esta disponible tras cargar el script.');
    }

    return new Promise<WompiWidgetResult>((resolve, reject) => {
      try {
        const checkout = new window.WidgetCheckout({
          currency: data.currency || 'COP',
          amountInCents,
          reference,
          publicKey,
          signature: { integrity: sig },
          redirectUrl: data.redirectUrl?.trim() || undefined
        });

        checkout.open((result: WompiWidgetResult) => {
          resolve(result ?? {});
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private cargarWidgetScript(): Promise<void> {
    if (window.WidgetCheckout) {
      return Promise.resolve();
    }

    if (!this.widgetScriptPromise) {
      this.widgetScriptPromise = this.loadWidgetScriptOnce().catch(err => {
        this.widgetScriptPromise = null;
        throw err;
      });
    }
    return this.widgetScriptPromise;
  }

  private async loadWidgetScriptOnce(): Promise<void> {
    if (window.WidgetCheckout) return;

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${WIDGET_SRC}"]`);
    if (existing) {
      await pollWidgetReady(15000, 50);
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = WIDGET_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(
          new Error(
            'No se pudo descargar https://checkout.wompi.co/widget.js. Revisa conexion, firewall o extensiones que bloqueen scripts.'
          )
        );
      document.head.appendChild(script);
    });

    await pollWidgetReady(15000, 50);
  }
}
