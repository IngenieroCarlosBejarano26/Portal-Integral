import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Subject, takeUntil } from 'rxjs';
import { PlanService, PlanTenant } from '../../services/plan.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { RealtimeEvents } from '../../../../core/services/realtime/realtime-events';

interface UsoItem {
  label: string;
  icon: string;
  actual: number;
  max?: number | null;     // null = ilimitado
  porcentaje?: number | null;
  color: string;
}

/**
 * Widget para el dashboard que muestra el plan actual del tenant
 * (Basico/Pro/Premium) con barras de progreso del uso de cada recurso.
 *
 * Se actualiza en tiempo real cuando cambia algun recurso (cliente, valera,
 * usuario) escuchando los eventos SignalR correspondientes.
 */
@Component({
  selector: 'app-plan-usage-widget',
  standalone: true,
  imports: [CommonModule, NzCardModule, NzProgressModule, NzButtonModule, NzIconModule, NzTagModule],
  templateUrl: './plan-usage-widget.component.html',
  styleUrl: './plan-usage-widget.component.css'
})
export class PlanUsageWidgetComponent implements OnInit, OnDestroy {
  private planService = inject(PlanService);
  private realtime = inject(RealtimeService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  plan: PlanTenant | null = null;
  loading = true;
  error: string | null = null;
  usos: UsoItem[] = [];

  ngOnInit(): void {
    this.recargar();

    // Re-cargar cuando se cree/elimine algun recurso para reflejar el uso al instante.
    const eventos = [
      RealtimeEvents.Cliente.Created,
      RealtimeEvents.Cliente.Deleted,
      RealtimeEvents.Valera.Created,
      RealtimeEvents.Valera.Deleted,
      RealtimeEvents.Usuario.Created,
      RealtimeEvents.Usuario.Deactivated
    ];
    eventos.forEach(ev => {
      this.realtime.on(ev).pipe(takeUntil(this.destroy$)).subscribe(() => this.recargar());
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  recargar(): void {
    this.loading = true;
    this.error = null;
    this.planService.obtenerMiPlan().subscribe({
      next: (p) => {
        this.plan = p;
        this.loading = false;
        this.calcularUsos();
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'No se pudo cargar el plan.';
        this.loading = false;
      }
    });
  }

  private calcularUsos(): void {
    if (!this.plan) { this.usos = []; return; }
    this.usos = [
      {
        label: 'Clientes',
        icon: 'usergroup-add',
        actual: this.plan.clientesActuales,
        max: this.plan.maxClientes,
        porcentaje: this.plan.porcentajeClientes,
        color: this.colorPorPorcentaje(this.plan.porcentajeClientes)
      },
      {
        label: 'Valeras',
        icon: 'qrcode',
        actual: this.plan.valerasActuales,
        max: this.plan.maxValeras,
        porcentaje: this.plan.porcentajeValeras,
        color: this.colorPorPorcentaje(this.plan.porcentajeValeras)
      },
      {
        label: 'Usuarios',
        icon: 'user',
        actual: this.plan.usuariosActuales,
        max: this.plan.maxUsuarios,
        porcentaje: this.plan.porcentajeUsuarios,
        color: this.colorPorPorcentaje(this.plan.porcentajeUsuarios)
      }
    ];
  }

  /** Verde < 70%, naranja 70-89%, rojo >= 90%. Null (ilimitado) = azul. */
  private colorPorPorcentaje(p: number | null | undefined): string {
    if (p == null) return '#0ea5e9';
    if (p >= 90) return '#ef4444';
    if (p >= 70) return '#f59e0b';
    return '#10b981';
  }

  irAUpgrade(): void {
    this.router.navigate(['/planes']);
  }

  /** Muestra "32 / 50" o "32 / ∞" si es ilimitado. */
  formatoUso(u: UsoItem): string {
    return `${u.actual} / ${u.max ?? '∞'}`;
  }
}
