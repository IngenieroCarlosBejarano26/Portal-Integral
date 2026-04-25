import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { ValeraService, Valera } from '../../../valeras/services/valera.service';
import { ConsumoService } from '../../../consumos/services/consumo.service';
import { ClienteService, Cliente } from '../../../clientes/services/cliente.service';
import { AuthService } from '../../../../core/services/auth/authService';

/**
 * Resolución del escaneo de QR.
 *
 * Flujo:
 *  1. authGuard → si no está logueado, redirige a /login?returnUrl=/v/{codigo}
 *  2. Carga la valera por código QR
 *  3. Carga el cliente asociado (para mostrar nombre/documento)
 *  4. Si el usuario tiene `valeras:execute` y la valera permite uso,
 *     muestra botón "Registrar 1 uso"
 *  5. Si no, muestra el detalle en modo lectura
 */
@Component({
  selector: 'app-qr-scan-page',
  standalone: true,
  imports: [CommonModule, NzButtonModule, NzIconModule, NzSpinModule],
  templateUrl: './qr-scan-page.component.html',
  styleUrl: './qr-scan-page.component.css'
})
export class QrScanPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private valeraService = inject(ValeraService);
  private clienteService = inject(ClienteService);
  private consumoService = inject(ConsumoService);
  private authService = inject(AuthService);
  private modal = inject(NzModalService);
  private notification = inject(NzNotificationService);

  loading = signal(true);
  consuming = signal(false);
  valera = signal<Valera | null>(null);
  cliente = signal<Cliente | null>(null);
  errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    const codigo = this.route.snapshot.paramMap.get('codigo');
    if (!codigo) {
      this.errorMsg.set('Código QR inválido.');
      this.loading.set(false);
      return;
    }
    this.cargarValera(codigo);
  }

  private cargarValera(codigo: string): void {
    this.valeraService.getByCodigoQR(codigo).subscribe({
      next: (v) => {
        if (!v) {
          this.errorMsg.set('No encontramos una valera asociada a este código.');
          this.loading.set(false);
          return;
        }
        this.valera.set(v);
        // Carga del cliente — opcional, mejora la UX
        if (v.clienteID) {
          this.clienteService.getById(v.clienteID).subscribe({
            next: (c) => { this.cliente.set(c ?? null); this.loading.set(false); },
            error: () => this.loading.set(false)
          });
        } else {
          this.loading.set(false);
        }
      },
      error: () => {
        this.errorMsg.set('No pudimos cargar la valera. Intenta de nuevo.');
        this.loading.set(false);
      }
    });
  }

  // ── Helpers de presentación ────────────────────────────────────────────
  get almuerzosRestantes(): number {
    const v = this.valera();
    if (!v) return 0;
    return (v.totalAlmuerzos ?? 0) - (v.almuerzosConsumidos ?? 0);
  }

  get vencida(): boolean {
    const v = this.valera();
    if (!v?.fechaVencimiento) return false;
    return new Date(v.fechaVencimiento) < new Date();
  }

  get sinCupo(): boolean { return this.almuerzosRestantes <= 0; }

  get inactiva(): boolean { return this.valera()?.estado === false; }

  get puedeConsumir(): boolean {
    return !this.vencida && !this.sinCupo && !this.inactiva
      && this.authService.hasPermission('valeras:execute');
  }

  /** Razón humana por la que NO se puede consumir (para mostrar al usuario). */
  get razonNoConsumir(): string | null {
    if (this.inactiva) return 'Esta valera está inactiva.';
    if (this.vencida) return 'Esta valera está vencida.';
    if (this.sinCupo) return 'No quedan usos disponibles en esta valera.';
    if (!this.authService.hasPermission('valeras:execute')) {
      return 'No tienes permiso para registrar consumos.';
    }
    return null;
  }

  get clienteNombreCompleto(): string {
    const c = this.cliente();
    if (!c) return 'Titular';
    return `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim() || 'Titular';
  }

  // ── Acción ─────────────────────────────────────────────────────────────
  consumir(): void {
    const v = this.valera();
    if (!v?.valeraID || !this.puedeConsumir) return;

    this.modal.confirm({
      nzTitle: '¿Registrar uso?',
      nzContent: `${this.clienteNombreCompleto} · Quedarán ${this.almuerzosRestantes - 1} uso(s)`,
      nzOkText: 'Sí, registrar',
      nzCancelText: 'Cancelar',
      nzOnOk: () => new Promise<void>((resolve) => {
        this.consuming.set(true);
        this.consumoService.createConsumo({
          valeraID: v.valeraID,
          fechaConsumo: new Date().toISOString(),
          observaciones: 'Uso registrado vía escaneo QR'
        }).subscribe({
          next: () => {
            this.consuming.set(false);
            // Optimistic update local del contador
            this.valera.set({ ...v, almuerzosConsumidos: (v.almuerzosConsumidos ?? 0) + 1 });
            this.notification.success(
              'Uso registrado',
              `Quedan ${this.almuerzosRestantes} uso(s).`
            );
            resolve();
          },
          error: (e) => {
            this.consuming.set(false);
            const isConflict = e?.status === 409;
            const msg = e?.error?.message ?? 'No se pudo registrar el consumo.';
            if (isConflict) this.notification.warning('No permitido', msg);
            else this.notification.error('Error', msg);
            resolve();
          }
        });
      })
    });
  }

  irADetalle(): void {
    const v = this.valera();
    if (v?.valeraID && this.authService.hasPermission('valeras:view')) {
      this.router.navigate(['/valeras']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }
}
