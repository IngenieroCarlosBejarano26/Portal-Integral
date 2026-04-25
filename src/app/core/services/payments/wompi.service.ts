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
  private widgetScriptLoaded?: Promise<void>;

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

  /**
   * Carga el script del widget si no esta cargado y abre el checkout.
   * Resuelve cuando el usuario cierra el widget (con o sin pago).
   */
  async lanzarWidget(data: IniciarPagoWompiResponse): Promise<WompiWidgetResult> {
    await this.cargarWidgetScript();

    if (!window.WidgetCheckout) {
      throw new Error('El widget de Wompi no se pudo cargar.');
    }

    return new Promise<WompiWidgetResult>((resolve, reject) => {
      try {
        const checkout = new window.WidgetCheckout({
          currency: data.currency || 'COP',
          amountInCents: data.amountInCents,
          reference: data.reference,
          publicKey: data.publicKey,
          signature: { integrity: data.signatureIntegrity },
          redirectUrl: data.redirectUrl
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
    if (this.widgetScriptLoaded) return this.widgetScriptLoaded;

    this.widgetScriptLoaded = new Promise<void>((resolve, reject) => {
      // Si por algun motivo ya esta cargado en el DOM, resolvemos.
      if (window.WidgetCheckout) {
        resolve();
        return;
      }

      const existing = document.querySelector<HTMLScriptElement>(`script[src="${WIDGET_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('No se pudo cargar el widget de Wompi.')));
        return;
      }

      const script = document.createElement('script');
      script.src = WIDGET_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar el widget de Wompi.'));
      document.head.appendChild(script);
    });

    return this.widgetScriptLoaded;
  }
}
