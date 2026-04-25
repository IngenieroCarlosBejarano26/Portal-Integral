import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Subject, takeUntil } from 'rxjs';
import { PagoManualService, SolicitudPagoManual } from '../../services/pago-manual.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';

@Component({
  selector: 'app-pagos-pendientes-page',
  standalone: true,
  imports: [CommonModule, FormsModule, NzTableModule, NzButtonModule, NzIconModule, NzTagModule, NzModalModule, NzInputModule],
  templateUrl: './pagos-pendientes-page.component.html',
  styleUrl: './pagos-pendientes-page.component.css'
})
export class PagosPendientesPageComponent implements OnInit, OnDestroy {
  private pagoService = inject(PagoManualService);
  private modal = inject(NzModalService);
  private notification = inject(NzNotificationService);
  private realtime = inject(RealtimeService);
  private destroy$ = new Subject<void>();

  solicitudes: SolicitudPagoManual[] = [];
  loading = true;
  procesando: string | null = null;

  ngOnInit(): void {
    this.recargar();
    // Refrescar lista en tiempo real cuando llega una nueva solicitud.
    this.realtime.on('pago-manual:created').pipe(takeUntil(this.destroy$))
      .subscribe(() => this.recargar());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  recargar(): void {
    this.loading = true;
    this.pagoService.listarPendientes().subscribe({
      next: (lista) => { this.solicitudes = lista; this.loading = false; },
      error: () => { this.loading = false; this.notification.error('Error', 'No se pudo cargar la lista.'); }
    });
  }

  verComprobante(s: SolicitudPagoManual): void {
    if (!s.comprobanteFileName) {
      this.notification.warning('Sin comprobante', 'Esta solicitud no tiene archivo adjunto.');
      return;
    }

    // No usamos window.open(url) porque el endpoint requiere JWT/X-Api-Key
    // y window.open NO inyecta headers. Descargamos el blob via HttpClient
    // (que pasa por el interceptor con auth) y lo abrimos como object URL.
    this.procesando = s.solicitudId;
    this.pagoService.descargarComprobante(s.solicitudId).subscribe({
      next: (blob) => {
        this.procesando = null;
        const url = URL.createObjectURL(blob);
        const tab = window.open(url, '_blank');
        if (!tab) {
          // Pop-up bloqueado: forzamos descarga como fallback.
          const a = document.createElement('a');
          a.href = url;
          a.download = s.comprobanteFileName ?? 'comprobante';
          a.click();
        }
        // Liberamos el object URL despues de un rato (suficiente para que el navegador lo lea).
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (err) => {
        this.procesando = null;
        const msg = err?.error?.message
          ?? (err?.status === 401 ? 'Tu sesion expiro. Vuelve a iniciar sesion.' : null)
          ?? (err?.status === 404 ? 'El comprobante no existe o no esta disponible.' : null)
          ?? 'No se pudo descargar el comprobante.';
        this.notification.error('Error al ver comprobante', msg);
      }
    });
  }

  aprobar(s: SolicitudPagoManual): void {
    this.modal.confirm({
      nzTitle: `Aprobar solicitud de ${s.tenantNombre}?`,
      nzContent: `Se activara el plan ${s.planNombre} ($ ${this.fmt(s.montoCOP)} COP). Esta accion es irreversible.`,
      nzOkText: 'Si, aprobar',
      nzOkType: 'primary',
      nzCancelText: 'Cancelar',
      nzOnOk: () => {
        this.procesando = s.solicitudId;
        this.pagoService.aprobar(s.solicitudId).subscribe({
          next: (res) => {
            this.procesando = null;
            if (res.success) {
              this.notification.success('Aprobada', `Plan ${s.planNombre} activado para ${s.tenantNombre}.`);
              this.recargar();
            } else {
              this.notification.error('Error', res.message ?? 'No se pudo aprobar.');
            }
          },
          error: (err) => {
            this.procesando = null;
            this.notification.error('Error', err?.error?.message ?? 'No se pudo aprobar.');
          }
        });
      }
    });
  }

  rechazar(s: SolicitudPagoManual): void {
    const motivo = (window.prompt(`Motivo del rechazo para ${s.tenantNombre} (sera visible para el cliente):`) ?? '').trim();
    if (!motivo) {
      this.notification.info('Cancelado', 'No se rechazo la solicitud.');
      return;
    }
    this.procesando = s.solicitudId;
    this.pagoService.rechazar(s.solicitudId, motivo).subscribe({
      next: (res) => {
        this.procesando = null;
        if (res.success) {
          this.notification.success('Rechazada', `Solicitud de ${s.tenantNombre} rechazada.`);
          this.recargar();
        } else {
          this.notification.error('Error', res.message ?? 'No se pudo rechazar.');
        }
      },
      error: (err) => {
        this.procesando = null;
        this.notification.error('Error', err?.error?.message ?? 'No se pudo rechazar.');
      }
    });
  }

  fmt(n: number): string {
    return Math.round(n).toLocaleString('es-CO');
  }
}
