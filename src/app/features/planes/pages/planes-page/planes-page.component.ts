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
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { UsdCopPipe } from '../../../../shared/pipes/usd-cop.pipe';
import { CurrencyService } from '../../../../core/services/currency/currency.service';
import { PagarManualModalComponent } from '../../../pagos-manuales/components/pagar-manual-modal/pagar-manual-modal.component';

@Component({
  selector: 'app-planes-page',
  standalone: true,
  imports: [CommonModule, NzCardModule, NzButtonModule, NzIconModule, NzTagModule, HasPermissionDirective, UsdCopPipe],
  templateUrl: './planes-page.component.html',
  styleUrl: './planes-page.component.css'
})
export class PlanesPageComponent implements OnInit {
  private planService = inject(PlanService);
  private modal = inject(NzModalService);
  private notification = inject(NzNotificationService);
  private currency = inject(CurrencyService);

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

    // Flujo MVP de pago manual: abre modal de pago (Nequi/Bancolombia + comprobante).
    // Cuando el super-admin apruebe, el plan se activa automaticamente.
    this.modal.create({
      nzTitle: `Activar plan ${plan.nombre}`,
      nzContent: PagarManualModalComponent,
      nzData: { plan },
      nzWidth: 720,
      nzFooter: null,
      nzMaskClosable: false,
      nzCentered: true,
      nzClassName: 'pagar-manual-modal-class'
    }).afterClose.subscribe((enviada) => {
      if (enviada) this.recargar();
    });
  }
}
