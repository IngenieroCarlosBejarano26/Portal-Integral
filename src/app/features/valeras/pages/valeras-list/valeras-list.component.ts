import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CardGridComponent, CardConfig, CardAction } from '../../../../shared/components/card-grid/card-grid.component';
import { FormModalComponent, FormField } from '../../../../shared/components/form-modal/form-modal.component';
import { ValeraService, Valera } from '../../services/valera.service';
import { ClienteService, Cliente } from '../../../clientes/services/cliente.service';
import { ConsumoService } from '../../../consumos/services/consumo.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { RealtimeEvents } from '../../../../core/services/realtime/realtime-events';
import { AuthService } from '../../../../core/services/auth/authService';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-valeras-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    CardGridComponent,
    HasPermissionDirective
  ],
  templateUrl: './valeras-list.component.html',
  styleUrl: './valeras-list.component.css'
})
export class ValerasListComponent implements OnInit, OnDestroy {
  private valeraService = inject(ValeraService);
  private clienteService = inject(ClienteService);
  private consumoService = inject(ConsumoService);
  private modal = inject(NzModalService);
  private notification = inject(NzNotificationService);
  private realtime = inject(RealtimeService);
  private authService = inject(AuthService);
  private destroy$ = new Subject<void>();

  valeras: Valera[] = [];
  filteredValeras: Valera[] = [];
  loading = false;
  searchValue = '';

  private clientesMap = new Map<string, Cliente>();

  private clienteField: FormField = {
    key: 'clienteID', label: 'Cliente', type: 'select', required: true, span: 12,
    placeholder: 'Selecciona un cliente', options: []
  };

  cardConfig: CardConfig = {
    titleKey: 'clienteNombre',
    subtitleKey: 'clienteDocumento',
    iconType: 'gift',
    statusKey: 'estado',
    fields: [
      { key: 'totalAlmuerzos', label: 'Almuerzos', icon: 'shopping-cart',
        format: (v, item) => `${item.almuerzosConsumidos ?? 0} / ${v ?? 0}` },
      { key: 'precioPagado', label: 'Precio', icon: 'dollar',
        format: (v) => v != null ? `$${Number(v).toLocaleString('es-CO')}` : '—' },
      { key: 'fechaVencimiento', label: 'Vence', icon: 'calendar',
        format: (v) => v ? new Date(v).toLocaleDateString('es-CO') : '—' },
      { key: 'codigoQR', label: 'QR', icon: 'qrcode',
        format: (v) => v ? String(v).substring(0, 8) + '…' : '—' }
    ]
  };

  cardActions: CardAction[] = [
    {
      label: 'Consumir',
      icon: 'thunderbolt',
      color: 'primary',
      action: (item) => this.consumirAlmuerzo(item),
      visible: (item) => this.authService.hasPermission('valeras:execute') && this.puedeConsumir(item)
    },
    {
      label: 'Editar', icon: 'edit',
      visible: () => this.authService.hasPermission('valeras:update'),
      action: (item) => this.openForm(item)
    },
    {
      label: 'Eliminar', icon: 'delete', color: 'danger',
      visible: () => this.authService.hasPermission('valeras:delete'),
      action: (item) => this.deleteValera(item)
    }
  ];

  fields: FormField[] = [
    this.clienteField,
    {
      key: 'fechaCompra', label: 'Fecha Compra', type: 'date', required: true, span: 12,
      errorMessages: { required: 'La fecha de compra es obligatoria.' }
    },
    {
      key: 'fechaVencimiento', label: 'Fecha Vencimiento', type: 'date', required: true, span: 12,
      errorMessages: { required: 'La fecha de vencimiento es obligatoria.' }
    },
    {
      key: 'totalAlmuerzos', label: 'Total Almuerzos', type: 'number', required: true, span: 12,
      min: 1, max: 1000,
      hint: 'Entre 1 y 1.000.',
      errorMessages: {
        required: 'El total de almuerzos es obligatorio.',
        min: 'Debe ser al menos 1.',
        max: 'No puede superar 1.000.'
      }
    },
    {
      key: 'precioPagado', label: 'Precio Pagado', type: 'currency', required: true, span: 12,
      min: 1, max: 100_000_000,
      hint: 'Máximo 100 millones.',
      errorMessages: {
        required: 'El precio pagado es obligatorio.',
        min: 'Debe ser mayor a 0.',
        max: 'No puede superar 100 millones.'
      }
    },
    { key: 'estado', label: 'Activo', type: 'switch', span: 12, mode: 'edit' }
  ];

  ngOnInit(): void {
    this.loadAll();

    const reloadAll = () => this.loadAll();
    this.realtime.on(RealtimeEvents.Valera.Created).pipe(takeUntil(this.destroy$)).subscribe(reloadAll);
    this.realtime.on(RealtimeEvents.Valera.Updated).pipe(takeUntil(this.destroy$)).subscribe(reloadAll);
    this.realtime.on(RealtimeEvents.Valera.Deleted).pipe(takeUntil(this.destroy$)).subscribe(reloadAll);
    this.realtime.on(RealtimeEvents.Cliente.Created).pipe(takeUntil(this.destroy$)).subscribe(reloadAll);
    this.realtime.on(RealtimeEvents.Cliente.Updated).pipe(takeUntil(this.destroy$)).subscribe(reloadAll);
    // Un consumo cambia los almuerzos disponibles → hay que refrescar valeras también.
    this.realtime.on(RealtimeEvents.Consumo.Created).pipe(takeUntil(this.destroy$)).subscribe(reloadAll);
    this.realtime.on(RealtimeEvents.Consumo.Deleted).pipe(takeUntil(this.destroy$)).subscribe(reloadAll);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Carga clientes y valeras en paralelo, hace JOIN en memoria por clienteID. */
  loadValeras(): void { this.loadAll(); }

  private loadAll(): void {
    this.loading = true;
    forkJoin({
      valeras: this.valeraService.getAll(),
      clientes: this.clienteService.getAll()
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ valeras, clientes }) => {
        this.clientesMap.clear();
        clientes.forEach(c => c.clienteID && this.clientesMap.set(c.clienteID, c));

        this.clienteField.options = clientes
          .filter(c => !!c.clienteID)
          .map(c => ({
            label: `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim() + (c.documento ? ` — ${c.documento}` : ''),
            value: c.clienteID!
          }));

        this.valeras = valeras.map(v => this.enrichWithCliente(v));
        this.applyFilter();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  private enrichWithCliente(v: Valera): Valera {
    const c = v.clienteID ? this.clientesMap.get(v.clienteID) : undefined;
    return {
      ...v,
      clienteNombre: c ? `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim() : 'Cliente desconocido',
      clienteDocumento: c?.documento ?? '—'
    };
  }

  /**
   * Incrementa localmente el contador de almuerzos consumidos de una valera
   * para dar feedback visual inmediato tras registrar un consumo, sin esperar
   * al round-trip del refetch ni al evento SignalR.
   */
  private applyOptimisticConsumo(valeraID: string): void {
    const idx = this.valeras.findIndex(v => v.valeraID === valeraID);
    if (idx === -1) return;
    const v = this.valeras[idx];
    const nuevos = (v.almuerzosConsumidos ?? 0) + 1;
    const total = v.totalAlmuerzos ?? 0;
    this.valeras[idx] = {
      ...v,
      almuerzosConsumidos: nuevos,
      // Si llegó al tope, se desactiva visualmente igual que en el backend.
      estado: v.estado && nuevos < total
    };
    this.applyFilter();
  }

  onSearch(value: string): void {
    this.searchValue = (value || '').toLowerCase();
    this.applyFilter();
  }

  private applyFilter(): void {
    const term = this.searchValue;
    if (!term) {
      this.filteredValeras = [...this.valeras];
      return;
    }
    this.filteredValeras = this.valeras.filter(v =>
      v.clienteNombre?.toLowerCase().includes(term) ||
      v.clienteDocumento?.toLowerCase().includes(term) ||
      v.codigoQR?.toLowerCase().includes(term)
    );
  }

  onReload(): void { this.loadAll(); }

  /** ¿Puede registrarse un consumo en esta valera ahora? */
  private puedeConsumir(v: Valera): boolean {
    if (!v.estado) return false;
    if (v.fechaVencimiento && new Date(v.fechaVencimiento) < new Date()) return false;
    if ((v.almuerzosConsumidos ?? 0) >= (v.totalAlmuerzos ?? 0)) return false;
    return true;
  }

  /** Modal liviano de confirmación rápida para consumir un almuerzo. */
  consumirAlmuerzo(valera: Valera): void {
    if (!valera.valeraID) return;
    const restantes = (valera.totalAlmuerzos ?? 0) - (valera.almuerzosConsumidos ?? 0);

    this.modal.confirm({
      nzTitle: '¿Registrar consumo?',
      nzContent: `Cliente: ${valera.clienteNombre} · Quedan ${restantes} almuerzo(s)`,
      nzOkText: 'Consumir',
      nzCancelText: 'Cancelar',
      nzOnOk: () => new Promise<void>((resolve) => {
        this.consumoService.createConsumo({
          valeraID: valera.valeraID,
          fechaConsumo: new Date().toISOString(),
          observaciones: ''
        }).subscribe({
          next: () => {
            // 1) Optimistic update local: incrementa el contador inmediatamente
            //    para feedback visual instantáneo (no esperamos al refetch).
            this.applyOptimisticConsumo(valera.valeraID!);

            this.notification.success('Consumo registrado',
              `${restantes - 1} almuerzo(s) restantes`);

            // 2) Refetch defensivo: garantiza datos frescos del servidor
            //    aunque SignalR no llegue (red intermitente, fallback a long polling, etc.).
            //    El evento realtime también disparará loadAll — es idempotente.
            this.loadAll();

            resolve();
          },
          error: (e) => {
            // 409 Conflict → la valera no permite el consumo (vencida, sin cupo, inactiva).
            // Mostramos un warning con el mensaje del backend en lugar de un error genérico.
            const isConflict = e?.status === 409;
            const msg = e?.error?.message ?? 'No se pudo registrar el consumo';
            if (isConflict) {
              this.notification.warning('Consumo no permitido', msg);
            } else {
              this.notification.error('Error', msg);
            }
            resolve();
          }
        });
      })
    });
  }

  openForm(valera?: Valera): void {
    const isEdit = !!valera;
    const modalRef = this.modal.create({
      nzTitle: isEdit ? 'Editar Valera' : 'Nueva Valera',
      nzContent: FormModalComponent,
      nzData: { fields: this.fields, initialValue: valera, mode: isEdit ? 'edit' : 'create' },
      nzFooter: null,
      nzWidth: 640,
      nzCentered: true
    });

    modalRef.afterClose.subscribe((result) => {
      if (!result) return;
      const obs = isEdit
        ? this.valeraService.updateValera({ ...result, valeraID: valera!.valeraID })
        : this.valeraService.createValera(result);
      obs.subscribe({
        next: () => {
          this.notification.success('Éxito', `Valera ${isEdit ? 'actualizada' : 'creada'} correctamente`);
          this.loadAll();
        },
        error: () => this.notification.error('Error', 'No se pudo procesar la solicitud')
      });
    });
  }

  deleteValera(valera: Valera): void {
    this.modal.confirm({
      nzTitle: '¿Eliminar valera?',
      nzContent: '¿Estás seguro de eliminar esta valera?',
      nzOkText: 'Eliminar',
      nzOkDanger: true,
      nzCancelText: 'Cancelar',
      nzOnOk: () => {
        if (!valera.valeraID) return;
        this.valeraService.deleteValera(valera.valeraID).subscribe({
          next: () => {
            this.notification.success('Éxito', 'Valera eliminada');
            this.loadAll();
          },
          error: () => this.notification.error('Error', 'No se pudo eliminar')
        });
      }
    });
  }
}
