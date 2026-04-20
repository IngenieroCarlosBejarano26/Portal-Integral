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
import { AuthService } from '../../../../core/services/auth/authService';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-tenants-list',
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
  templateUrl: './tenants-list.component.html',
  styleUrl: './tenants-list.component.css'
})
export class TenantsListComponent implements OnInit, OnDestroy {
  private tenantService = inject(TenantService);
  private modal = inject(NzModalService);
  private notification = inject(NzNotificationService);
  private realtime = inject(RealtimeService);
  private authService = inject(AuthService);
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
    {
      label: 'Editar', icon: 'edit',
      visible: () => this.authService.hasPermission('tenants:update'),
      action: (item) => this.openForm(item)
    },
    {
      label: 'Eliminar', icon: 'delete', color: 'danger',
      visible: () => this.authService.hasPermission('tenants:delete'),
      action: (item) => this.deleteTenant(item)
    }
  ];

  fields: FormField[] = [
    {
      key: 'nombre', label: 'Nombre', type: 'text', required: true, span: 12,
      placeholder: 'Nombre del tenant',
      minLength: 3, maxLength: 100,
      pattern: /^[\p{L}\s.,'\-]+$/u,
      errorMessages: {
        required: 'El nombre es obligatorio.',
        minlength: 'Mínimo 3 caracteres.',
        maxlength: 'Máximo 100 caracteres.',
        pattern: 'Solo letras, espacios, puntos, comas, apóstrofes y guiones.'
      }
    },
    { key: 'activo', label: 'Activo', type: 'switch', span: 12 },
    {
      key: 'connectionString', label: 'Connection String', type: 'textarea', required: true,
      placeholder: 'Server=...;Database=...',
      maxLength: 500,
      pattern: /^.*Server\s*=.*Database\s*=.*$/i,
      hint: 'Debe contener Server= y Database=. Máximo 500 caracteres.',
      errorMessages: {
        required: 'El connection string es obligatorio.',
        maxlength: 'Máximo 500 caracteres.',
        pattern: 'Debe contener al menos Server= y Database=.'
      }
    }
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
