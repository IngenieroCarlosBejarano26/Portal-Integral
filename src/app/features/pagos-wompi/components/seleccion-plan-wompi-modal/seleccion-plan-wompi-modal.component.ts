import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { forkJoin } from 'rxjs';
import { PlanService, PlanCatalogo, PlanTenant } from '../../../planes/services/plan.service';
import { UsdCopPipe } from '../../../../shared/pipes/usd-cop.pipe';

/**
 * Modal que muestra el catálogo de planes para que el usuario elija cuál pagar
 * por Wompi. Al seleccionar, cierra el modal devolviendo el plan elegido; el
 * componente padre se encarga de lanzar el modal de pago propiamente dicho.
 *
 * El plan actual queda marcado y deshabilitado: pagar el mismo plan no tiene
 * sentido y evita confusiones.
 */
@Component({
  selector: 'app-seleccion-plan-wompi-modal',
  standalone: true,
  imports: [CommonModule, NzCardModule, NzButtonModule, NzIconModule, NzTagModule, UsdCopPipe],
  templateUrl: './seleccion-plan-wompi-modal.component.html',
  styleUrl: './seleccion-plan-wompi-modal.component.css'
})
export class SeleccionPlanWompiModalComponent implements OnInit {
  private planService = inject(PlanService);
  private modalRef = inject(NzModalRef<SeleccionPlanWompiModalComponent, PlanCatalogo | null>);
  private notification = inject(NzNotificationService);

  catalogo: PlanCatalogo[] = [];
  miPlan: PlanTenant | null = null;
  loading = true;

  ngOnInit(): void {
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
        this.notification.error('Error', 'No se pudieron cargar los planes.');
      }
    });
  }

  esPlanActual(planId: string): boolean {
    return this.miPlan?.planId === planId;
  }

  formatoLimite(v: number | null | undefined): string {
    return v == null ? 'Ilimitado' : v.toString();
  }

  elegir(plan: PlanCatalogo): void {
    if (this.esPlanActual(plan.planId)) return;
    this.modalRef.close(plan);
  }

  cancelar(): void {
    this.modalRef.close(null);
  }
}
