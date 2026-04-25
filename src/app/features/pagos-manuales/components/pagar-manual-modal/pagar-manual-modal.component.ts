import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzModalRef, NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Subscription, interval, merge } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import { PagoManualService, InfoPagoPublica, MetodoPago } from '../../services/pago-manual.service';
import { CurrencyService } from '../../../../core/services/currency/currency.service';
import { PlanCatalogo } from '../../../planes/services/plan.service';
import { WompiService, IniciarPagoWompiResponse } from '../../../../core/services/payments/wompi.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { RealtimeEvents } from '../../../../core/services/realtime/realtime-events';

/**
 * Datos opcionales que el invocador puede pasar al abrir el modal.
 * - `iniciarFlujo`: si se pasa 'wompi' o 'manual', el modal se salta la pantalla
 *   de selección y arranca directo en ese flujo. Útil cuando ya estamos en una
 *   pestaña dedicada (ej. "Pagos en línea") y la elección no aporta nada.
 */
interface ModalData {
  plan: PlanCatalogo;
  iniciarFlujo?: 'seleccion' | 'manual' | 'wompi';
}

/**
 * Estados del modal:
 *  - seleccion: usuario aun no eligio metodo (vista inicial con dos cards).
 *  - manual: flujo de transferencia + comprobante (igual al original).
 *  - wompi: esperando que el usuario interactue con el widget.
 *  - wompi-pendiente: widget cerrado, polling al backend esperando webhook.
 *  - wompi-aprobado / wompi-rechazado: estados terminales.
 */
type Flujo = 'seleccion' | 'manual' | 'wompi' | 'wompi-pendiente' | 'wompi-aprobado' | 'wompi-rechazado';

@Component({
  selector: 'app-pagar-manual-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NzButtonModule, NzIconModule, NzInputModule, NzToolTipModule],
  templateUrl: './pagar-manual-modal.component.html',
  styleUrl: './pagar-manual-modal.component.css'
})
export class PagarManualModalComponent implements OnInit, OnDestroy {
  private data: ModalData = inject(NZ_MODAL_DATA);
  plan: PlanCatalogo = this.data.plan;

  private pagoService = inject(PagoManualService);
  private currency = inject(CurrencyService);
  private modalRef = inject(NzModalRef);
  private notification = inject(NzNotificationService);
  private wompiService = inject(WompiService);
  private realtime = inject(RealtimeService);

  // ---------- Estado general ----------
  flujo: Flujo = 'seleccion';
  cargando = false;

  // ---------- Estado del flujo manual ----------
  info: InfoPagoPublica | null = null;
  metodoPago: MetodoPago = 'Nequi';
  referenciaPago = '';
  notas = '';
  comprobanteBase64: string | null = null;
  comprobanteFileName: string | null = null;
  comprobanteContentType: string | null = null;
  comprobantePreviewUrl: string | null = null;
  comprobanteSizeKb: number | null = null;
  enviando = false;
  copiado: 'Nequi' | 'Bancolombia' | null = null;

  // ---------- Estado del flujo Wompi ----------
  wompiData: IniciarPagoWompiResponse | null = null;
  wompiError: string | null = null;
  wompiMotivoRechazo: string | null = null;
  private pollingSub?: Subscription;
  private realtimeSub?: Subscription;

  ngOnInit(): void {
    // Suscripcion temprana a los eventos del webhook Wompi del propio tenant.
    // Si el webhook llega mientras el usuario sigue interactuando con el widget,
    // no perdemos el evento (lo aplicamos cuando ya tengamos `wompiData`).
    const aprobado$ = this.realtime.on<any>(RealtimeEvents.PagoWompi.Approved);
    const rechazado$ = this.realtime.on<any>(RealtimeEvents.PagoWompi.Declined);

    this.realtimeSub = merge(
      aprobado$.pipe(switchMap(async payload => ({ tipo: 'aprobado' as const, payload }))),
      rechazado$.pipe(switchMap(async payload => ({ tipo: 'rechazado' as const, payload })))
    ).subscribe(({ tipo, payload }) => {
      if (!this.esMiReferencia(payload)) return;
      if (tipo === 'aprobado') this.marcarAprobado();
      else this.marcarRechazado(payload?.motivoRechazo ?? payload?.wompiStatus);
    });

    // Si nos pidieron arrancar directamente en un flujo, lo disparamos.
    // Útil cuando el modal se invoca desde la pestaña "Pagos en línea".
    const inicial = this.data.iniciarFlujo;
    if (inicial === 'wompi') {
      this.elegirWompi();
    } else if (inicial === 'manual') {
      this.elegirManual();
    }
  }

  ngOnDestroy(): void {
    this.pollingSub?.unsubscribe();
    this.realtimeSub?.unsubscribe();
  }

  // ============================================================================
  // SELECCION DE FLUJO
  // ============================================================================

  elegirWompi(): void {
    this.flujo = 'wompi';
    this.wompiError = null;
    this.cargando = true;
    this.wompiService.iniciar({
      planSolicitadoId: this.plan.planId,
      precioUSD: this.plan.precioMensualUSD,
      tasaCambio: this.currency.getRate(),
      montoCOP: this.montoCOP
    }).subscribe({
      next: (res) => {
        if (!res.success || !res.data) {
          this.cargando = false;
          this.wompiError = res.message ?? 'No se pudo iniciar el pago en linea.';
          return;
        }
        this.wompiData = res.data;
        this.cargando = false;
        void this.abrirWidget();
      },
      error: (err) => {
        this.cargando = false;
        this.wompiError = err?.error?.message ?? 'No se pudo iniciar el pago en linea.';
      }
    });
  }

  elegirManual(): void {
    this.flujo = 'manual';
    if (this.info || this.cargando) return;
    this.cargando = true;
    this.pagoService.obtenerInfoPago().subscribe({
      next: (info) => { this.info = info; this.cargando = false; },
      error: () => {
        this.cargando = false;
        this.notification.error('Error', 'No se pudieron cargar los datos de pago.');
      }
    });
  }

  volverASeleccion(): void {
    if (this.enviando) return;
    // Si el modal fue abierto en un flujo fijo (ej. desde la pestaña "Pagos en
    // línea"), no hay selección previa a la que volver: cerramos el modal.
    if (!this.puedeVolverASeleccion) {
      this.cancelar();
      return;
    }
    this.flujo = 'seleccion';
    this.wompiError = null;
  }

  /**
   * True si tiene sentido mostrar el link "volver a selección". Si el modal
   * fue abierto con `iniciarFlujo`, no hay nada a qué volver dentro del modal:
   * lo correcto es cerrarlo y que el usuario vea la página invocadora.
   */
  get puedeVolverASeleccion(): boolean {
    return !this.data.iniciarFlujo;
  }

  // ============================================================================
  // FLUJO WOMPI
  // ============================================================================

  private async abrirWidget(): Promise<void> {
    if (!this.wompiData) return;
    try {
      await this.wompiService.lanzarWidget(this.wompiData);
    } catch (err) {
      this.wompiError = (err as Error)?.message ?? 'Error abriendo el widget.';
      return;
    }

    // El widget cerro. Pasamos a estado pendiente y disparamos polling
    // mientras esperamos el webhook (el realtime puede llegar antes).
    if (this.flujo === 'wompi') {
      this.flujo = 'wompi-pendiente';
      this.iniciarPollingEstado();
    }
  }

  private iniciarPollingEstado(): void {
    if (!this.wompiData) return;
    const reference = this.wompiData.reference;

    // Polling cada 3s durante 30s. Para de inmediato si llegamos a estado terminal
    // o si el realtime ya cambio el flujo.
    let intentos = 0;
    this.pollingSub = interval(3000).pipe(
      takeWhile(() => intentos < 10 && this.flujo === 'wompi-pendiente'),
      switchMap(() => {
        intentos++;
        return this.wompiService.consultarEstado(reference);
      })
    ).subscribe({
      next: (estado) => {
        if (!estado) return;
        if (estado.estado === 'Aprobado') this.marcarAprobado();
        else if (estado.estado === 'Rechazado') this.marcarRechazado(estado.motivoRechazo ?? estado.wompiStatus);
      }
    });
  }

  private esMiReferencia(payload: any): boolean {
    if (!this.wompiData) return false;
    return payload?.wompiReference === this.wompiData.reference;
  }

  private marcarAprobado(): void {
    if (this.flujo === 'wompi-aprobado') return;
    this.flujo = 'wompi-aprobado';
    this.pollingSub?.unsubscribe();
    this.notification.success('Pago aprobado', 'Tu plan se activo correctamente.');
  }

  private marcarRechazado(motivo?: string | null): void {
    if (this.flujo === 'wompi-rechazado') return;
    this.flujo = 'wompi-rechazado';
    this.wompiMotivoRechazo = motivo ?? null;
    this.pollingSub?.unsubscribe();
  }

  reintentarWompi(): void {
    this.wompiError = null;
    this.wompiData = null;
    this.elegirWompi();
  }

  cerrarConExito(): void {
    this.modalRef.close('wompi-aprobado');
  }

  // ============================================================================
  // FLUJO MANUAL (sin cambios funcionales)
  // ============================================================================

  get montoCOP(): number {
    return Math.round(this.currency.toCop(this.plan.precioMensualUSD));
  }

  get montoCOPFormateado(): string {
    return this.montoCOP.toLocaleString('es-CO');
  }

  get qrNequiUrl(): string {
    const numeroLimpio = (this.info?.nequiNumero ?? '').replace(/\s+/g, '');
    if (!numeroLimpio) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(numeroLimpio)}`;
  }

  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.cargarArchivo(file, input);
  }

  onArchivoSoltado(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.cargarArchivo(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  private cargarArchivo(file: File, input?: HTMLInputElement): void {
    if (file.size > 5 * 1024 * 1024) {
      this.notification.warning('Archivo muy grande', 'El comprobante no debe superar 5 MB.');
      if (input) input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      this.comprobanteBase64 = base64;
      this.comprobanteFileName = file.name;
      this.comprobanteContentType = file.type;
      this.comprobanteSizeKb = Math.round(file.size / 1024);
      this.comprobantePreviewUrl = file.type.startsWith('image/') ? result : null;
    };
    reader.readAsDataURL(file);
  }

  removerComprobante(): void {
    this.comprobanteBase64 = null;
    this.comprobanteFileName = null;
    this.comprobanteContentType = null;
    this.comprobantePreviewUrl = null;
    this.comprobanteSizeKb = null;
  }

  copiarAlPortapapeles(texto: string, etiqueta: string, metodo?: 'Nequi' | 'Bancolombia'): void {
    if (!texto) return;
    navigator.clipboard.writeText(texto).then(
      () => {
        this.notification.success('Copiado', `${etiqueta} copiado al portapapeles.`);
        if (metodo) {
          this.copiado = metodo;
          setTimeout(() => { if (this.copiado === metodo) this.copiado = null; }, 1800);
        }
      },
      () => this.notification.error('Error', 'No se pudo copiar.')
    );
  }

  get tasaCambioFormateada(): string {
    return Math.round(this.currency.getRate()).toLocaleString('es-CO');
  }

  get pasoActual(): 1 | 2 | 3 {
    if (!this.referenciaPago.trim()) return this.comprobanteFileName ? 3 : 2;
    return 3;
  }

  enviar(): void {
    if (!this.referenciaPago.trim()) {
      this.notification.warning('Referencia requerida', 'Ingresa la referencia/numero de transaccion.');
      return;
    }

    this.enviando = true;
    this.pagoService.solicitar({
      planSolicitadoId: this.plan.planId,
      precioUSD: this.plan.precioMensualUSD,
      montoCOP: this.montoCOP,
      tasaCambio: this.currency.getRate(),
      metodoPago: this.metodoPago,
      referenciaPago: this.referenciaPago.trim(),
      notas: this.notas?.trim() || undefined,
      comprobanteBase64: this.comprobanteBase64 ?? undefined,
      comprobanteFileName: this.comprobanteFileName ?? undefined,
      comprobanteContentType: this.comprobanteContentType ?? undefined
    }).subscribe({
      next: (res) => {
        this.enviando = false;
        if (res.success) {
          this.notification.success('Solicitud enviada',
            res.message ?? 'Te avisaremos cuando sea aprobada.');
          this.modalRef.close(true);
        } else {
          this.notification.error('Error', res.message ?? 'No se pudo enviar.');
        }
      },
      error: (err) => {
        this.enviando = false;
        this.notification.error('Error', err?.error?.message ?? 'No se pudo enviar.');
      }
    });
  }

  cancelar(): void {
    this.modalRef.close(false);
  }
}
