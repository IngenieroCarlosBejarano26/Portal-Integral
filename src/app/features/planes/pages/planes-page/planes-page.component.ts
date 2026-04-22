import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { forkJoin } from 'rxjs';
import { PlanService, PlanCatalogo, PlanTenant } from '../../services/plan.service';

@Component({
  selector: 'app-planes-page',
  standalone: true,
  imports: [CommonModule, NzCardModule, NzButtonModule, NzIconModule, NzTagModule],
  templateUrl: './planes-page.component.html',
  styleUrl: './planes-page.component.css'
})
export class PlanesPageComponent implements OnInit {
  private planService = inject(PlanService);
  private modal = inject(NzModalService);
  private notification = inject(NzNotificationService);

  catalogo: PlanCatalogo[] = [];
  miPlan: PlanTenant | null = null;
  loading = true;
  cambiando: string | null = null; // planId que se esta cambiando

  ngOnInit(): void {
    this.recargar();
  }

  recargar(): void {
    this.loading = true;
    forkJoin({
      catalogo: this.planService.listarPlanes(),
      miPlan: this.planService.obtenerMiPlan()
    }).subscribe({
      next: ({ catalogo, miPlan }) => {
        this.catalogo = catalogo;
        this.miPlan = miPlan;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.notification.error('Error', 'No se pudo cargar la informacion de planes.');
      }
    });
  }

  esPlanActual(planId: string): boolean {
    return this.miPlan?.planId === planId;
  }

  /** Texto descriptivo de un limite. NULL = ilimitado. */
  formatoLimite(v: number | null | undefined): string {
    return v == null ? 'Ilimitado' : v.toString();
  }

  cambiarPlan(plan: PlanCatalogo): void {
    if (this.esPlanActual(plan.planId)) return;

    this.modal.confirm({
      nzTitle: `Cambiar al plan ${plan.nombre}?`,
      nzContent: `Tu suscripcion sera actualizada inmediatamente al plan ${plan.nombre} (USD $${plan.precioMensualUSD}/mes). Si reduces el plan y excedes los nuevos limites, el cambio sera bloqueado.`,
      nzOkText: 'Si, cambiar',
      nzCancelText: 'Cancelar',
      nzOnOk: () => {
        this.cambiando = plan.planId;
        this.planService.cambiarPlan(plan.planId).subscribe({
          next: (res) => {
            this.cambiando = null;
            if (res.success) {
              this.notification.success('Plan actualizado', res.message ?? `Ahora tienes el plan ${plan.nombre}.`);
              this.recargar();
            } else {
              this.notification.error('No se pudo cambiar el plan', res.message ?? 'Error desconocido.');
            }
          },
          error: (err) => {
            this.cambiando = null;
            this.notification.error('Error', err?.error?.message ?? 'No se pudo cambiar el plan.');
          }
        });
      }
    });
  }
}
