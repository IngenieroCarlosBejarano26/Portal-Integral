import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { Subject, takeUntil } from 'rxjs';
import { WompiService, EstadoPagoWompi } from '../../../../core/services/payments/wompi.service';
import { PlanCatalogo } from '../../../planes/services/plan.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { RealtimeEvents } from '../../../../core/services/realtime/realtime-events';
import { SeleccionPlanWompiModalComponent } from '../../components/seleccion-plan-wompi-modal/seleccion-plan-wompi-modal.component';
import { PagarManualModalComponent } from '../../../pagos-manuales/components/pagar-manual-modal/pagar-manual-modal.component';

/**
 * "Pagos en línea": vista del tenant logueado donde puede:
 *  - Iniciar un pago Wompi (botón "Pagar plan ahora" → modal selector → modal de pago).
 *  - Ver el historial de sus pagos Wompi (estado, monto, plan, fecha, motivo de rechazo).
 *
 * Se actualiza automáticamente al recibir eventos realtime de aprobación/rechazo
 * para que el usuario vea el cambio sin tener que refrescar manualmente.
 */
@Component({
  selector: 'app-pagos-wompi-page',
  standalone: true,
  imports: [CommonModule, NzTableModule, NzButtonModule, NzIconModule, NzTagModule, NzEmptyModule],
  templateUrl: './pagos-wompi-page.component.html',
  styleUrl: './pagos-wompi-page.component.css'
})
export class PagosWompiPageComponent implements OnInit, OnDestroy {
  private wompiService = inject(WompiService);
  private modal = inject(NzModalService);
  private notification = inject(NzNotificationService);
  private realtime = inject(RealtimeService);
  private destroy$ = new Subject<void>();

  pagos: EstadoPagoWompi[] = [];
  loading = true;

  ngOnInit(): void {
    this.recargar();

    // Refrescar el listado cuando llegue confirmación o rechazo del webhook.
    this.realtime.on(RealtimeEvents.PagoWompi.Approved)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.recargar());
    this.realtime.on(RealtimeEvents.PagoWompi.Declined)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.recargar());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  recargar(): void {
    this.loading = true;
    this.wompiService.listarMisPagos().subscribe({
      next: (lista) => { this.pagos = lista; this.loading = false; },
      error: () => {
        this.loading = false;
        this.notification.error('Error', 'No se pudo cargar el historial de pagos.');
      }
    });
  }

  abrirSeleccionPlan(): void {
    const ref = this.modal.create<SeleccionPlanWompiModalComponent, PlanCatalogo | null>({
      nzTitle: 'Seleccionar plan a pagar',
      nzContent: SeleccionPlanWompiModalComponent,
      nzFooter: null,
      nzWidth: 760,
      nzCentered: true,
      nzMaskClosable: false
    });

    ref.afterClose.subscribe((plan) => {
      if (!plan) return;
      this.lanzarPagoWompi(plan);
    });
  }

  /**
   * Reusa el modal existente PagarManualModalComponent pero saltándose la
   * pantalla de selección manual/Wompi: como el usuario está en "Pagos en
   * línea", inicia el flujo Wompi automáticamente.
   */
  private lanzarPagoWompi(plan: PlanCatalogo): void {
    const ref = this.modal.create({
      nzTitle: `Pagar plan ${plan.nombre} con Wompi`,
      nzContent: PagarManualModalComponent,
      nzData: { plan, iniciarFlujo: 'wompi' },
      nzFooter: null,
      nzWidth: 720,
      nzCentered: true,
      nzMaskClosable: false,
      nzClassName: 'pagar-manual-modal-class'
    });

    ref.afterClose.subscribe(() => {
      // Recargamos siempre: incluso si el usuario cerró sin completar puede
      // haber quedado un registro Pendiente que debe verse en la tabla.
      this.recargar();
    });
  }

  badgeColor(estado: EstadoPagoWompi['estado']): string {
    switch (estado) {
      case 'Aprobado': return 'green';
      case 'Rechazado': return 'red';
      default: return 'gold';
    }
  }

  badgeIcon(estado: EstadoPagoWompi['estado']): string {
    switch (estado) {
      case 'Aprobado': return 'check-circle';
      case 'Rechazado': return 'close-circle';
      default: return 'clock-circle';
    }
  }

  fmtCop(n: number): string {
    return Math.round(n).toLocaleString('es-CO');
  }

  verDetalleRechazo(p: EstadoPagoWompi): void {
    this.modal.info({
      nzTitle: 'Motivo del rechazo',
      nzContent:
        p.motivoRechazo?.trim()
          ? p.motivoRechazo
          : `La pasarela reportó estado "${p.wompiStatus ?? 'desconocido'}".`,
      nzOkText: 'Cerrar'
    });
  }
}
