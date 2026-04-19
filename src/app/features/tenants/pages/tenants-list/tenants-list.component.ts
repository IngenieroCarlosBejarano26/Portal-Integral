import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CardGridComponent, CardConfig, CardAction } from '../../../../shared/components/card-grid/card-grid.component';
import { FormModalComponent, FormField } from '../../../../shared/components/form-modal/form-modal.component';
import { TenantService, Tenant } from '../../services/tenant.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { RealtimeEvents } from '../../../../core/services/realtime/realtime-events';

@Component({
  selector: 'app-tenants-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    CardGridComponent
  ],
  templateUrl: './tenants-list.component.html',
  styleUrl: './tenants-list.component.css'
})
export class TenantsListComponent implements OnInit, OnDestroy {
  private tenantService = inject(TenantService);
  private modal = inject(NzModalService);
  private notification = inject(NzNotificationService);
  private realtime = inject(RealtimeService);
  private destroy$ = new Subject<void>();

  tenants: Tenant[] = [];
  filteredTenants: Tenant[] = [];
  loading = false;
  searchValue = '';

  cardConfig: CardConfig = {
    titleKey: 'nombre',
    iconType: 'bank',
    statusKey: 'activo',
    fields: [
      { key: 'connectionString', label: 'Conexión', icon: 'database', format: (v) => v ? '••• configurada' : '—' },
      { key: 'fechaCreacion', label: 'Creado', icon: 'calendar', format: (v) => v ? new Date(v).toLocaleDateString('es-CO') : '—' }
    ]
  };

  cardActions: CardAction[] = [
    { label: 'Editar', icon: 'edit', action: (item) => this.openForm(item) },
    { label: 'Eliminar', icon: 'delete', color: 'danger', action: (item) => this.deleteTenant(item) }
  ];

  fields: FormField[] = [
    { key: 'nombre', label: 'Nombre', type: 'text', required: true, span: 12, placeholder: 'Nombre del tenant' },
    { key: 'activo', label: 'Activo', type: 'switch', span: 12 },
    { key: 'connectionString', label: 'Connection String', type: 'textarea', required: true, placeholder: 'Server=...;Database=...' }
  ];

  ngOnInit(): void {
    this.loadTenants();
    const reload = () => this.loadTenants();
    this.realtime.on(RealtimeEvents.Tenant.Created).pipe(takeUntil(this.destroy$)).subscribe(reload);
    this.realtime.on(RealtimeEvents.Tenant.Updated).pipe(takeUntil(this.destroy$)).subscribe(reload);
    this.realtime.on(RealtimeEvents.Tenant.Deleted).pipe(takeUntil(this.destroy$)).subscribe(reload);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTenants(): void {
    this.loading = true;
    this.tenantService.loadTenants().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.tenants = data;
        this.applyFilter();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  onSearch(value: string): void {
    this.searchValue = value.toLowerCase();
    this.applyFilter();
  }

  private applyFilter(): void {
    if (!this.searchValue) {
      this.filteredTenants = [...this.tenants];
    } else {
      this.filteredTenants = this.tenants.filter(t =>
        t.nombre?.toLowerCase().includes(this.searchValue)
      );
    }
  }

  onReload(): void { this.loadTenants(); }

  openForm(tenant?: Tenant): void {
    const isEdit = !!tenant;
    const modalRef = this.modal.create({
      nzTitle: isEdit ? 'Editar Tenant' : 'Nuevo Tenant',
      nzContent: FormModalComponent,
      nzData: { fields: this.fields, initialValue: tenant, mode: isEdit ? 'edit' : 'create' },
      nzFooter: null,
      nzWidth: 640,
      nzCentered: true
    });

    modalRef.afterClose.subscribe((result) => {
      if (!result) return;
      const obs = isEdit
        ? this.tenantService.updateTenant({ ...result, tenantId: tenant!.tenantId })
        : this.tenantService.createTenant(result);
      obs.subscribe({
        next: () => {
          this.notification.success('Éxito', `Tenant ${isEdit ? 'actualizado' : 'creado'} correctamente`);
          this.loadTenants();
        },
        error: () => this.notification.error('Error', 'No se pudo procesar la solicitud')
      });
    });
  }

  deleteTenant(tenant: Tenant): void {
    this.modal.confirm({
      nzTitle: '¿Eliminar tenant?',
      nzContent: `¿Estás seguro de eliminar "${tenant.nombre}"?`,
      nzOkText: 'Eliminar',
      nzOkDanger: true,
      nzCancelText: 'Cancelar',
      nzOnOk: () => {
        this.tenantService.deleteTenant(tenant.tenantId!).subscribe({
          next: () => {
            this.notification.success('Éxito', 'Tenant eliminado');
            this.loadTenants();
          },
          error: () => this.notification.error('Error', 'No se pudo eliminar')
        });
      }
    });
  }
}
