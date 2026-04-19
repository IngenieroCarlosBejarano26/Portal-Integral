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
import { RolService, Rol } from '../../services/rol.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { RealtimeEvents } from '../../../../core/services/realtime/realtime-events';

@Component({
  selector: 'app-roles-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    CardGridComponent
  ],
  templateUrl: './roles-list.component.html',
  styleUrl: './roles-list.component.css'
})
export class RolesListComponent implements OnInit, OnDestroy {
  private rolService = inject(RolService);
  private modal = inject(NzModalService);
  private notification = inject(NzNotificationService);
  private realtime = inject(RealtimeService);
  private destroy$ = new Subject<void>();

  roles: Rol[] = [];
  filteredRoles: Rol[] = [];
  loading = false;
  searchValue = '';

  cardConfig: CardConfig = {
    titleKey: 'nombre',
    subtitleKey: 'descripcion',
    iconType: 'safety',
    fields: [
      { key: 'fechaCreacion', label: 'Creado', icon: 'calendar', format: (v) => v ? new Date(v).toLocaleDateString('es-CO') : '—' }
    ]
  };

  cardActions: CardAction[] = [
    { label: 'Editar', icon: 'edit', action: (item) => this.openForm(item) },
    { label: 'Eliminar', icon: 'delete', color: 'danger', action: (item) => this.deleteRol(item) }
  ];

  fields: FormField[] = [
    { key: 'nombre', label: 'Nombre del Rol', type: 'text', required: true, placeholder: 'Ej. Administrador' },
    { key: 'descripcion', label: 'Descripción', type: 'textarea', placeholder: 'Describe los permisos del rol' }
  ];

  ngOnInit(): void {
    this.loadRoles();
    const reload = () => this.loadRoles();
    this.realtime.on(RealtimeEvents.Rol.Created).pipe(takeUntil(this.destroy$)).subscribe(reload);
    this.realtime.on(RealtimeEvents.Rol.Updated).pipe(takeUntil(this.destroy$)).subscribe(reload);
    this.realtime.on(RealtimeEvents.Rol.Deleted).pipe(takeUntil(this.destroy$)).subscribe(reload);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadRoles(): void {
    this.loading = true;
    this.rolService.loadRoles().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.roles = data;
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
      this.filteredRoles = [...this.roles];
    } else {
      this.filteredRoles = this.roles.filter(r =>
        r.nombre?.toLowerCase().includes(this.searchValue) ||
        r.descripcion?.toLowerCase().includes(this.searchValue)
      );
    }
  }

  onReload(): void { this.loadRoles(); }

  openForm(rol?: Rol): void {
    const isEdit = !!rol;
    const modalRef = this.modal.create({
      nzTitle: isEdit ? 'Editar Rol' : 'Nuevo Rol',
      nzContent: FormModalComponent,
      nzData: { fields: this.fields, initialValue: rol, mode: isEdit ? 'edit' : 'create' },
      nzFooter: null,
      nzWidth: 560,
      nzCentered: true
    });

    modalRef.afterClose.subscribe((result) => {
      if (!result) return;
      const obs = isEdit
        ? this.rolService.updateRol({ ...result, rolId: rol!.rolId })
        : this.rolService.createRol(result);
      obs.subscribe({
        next: () => {
          this.notification.success('Éxito', `Rol ${isEdit ? 'actualizado' : 'creado'} correctamente`);
          this.loadRoles();
        },
        error: () => this.notification.error('Error', 'No se pudo procesar la solicitud')
      });
    });
  }

  deleteRol(rol: Rol): void {
    this.modal.confirm({
      nzTitle: '¿Eliminar rol?',
      nzContent: `¿Estás seguro de eliminar el rol "${rol.nombre}"?`,
      nzOkText: 'Eliminar',
      nzOkDanger: true,
      nzCancelText: 'Cancelar',
      nzOnOk: () => {
        this.rolService.deleteRol(rol.rolId!).subscribe({
          next: () => {
            this.notification.success('Éxito', 'Rol eliminado');
            this.loadRoles();
          },
          error: () => this.notification.error('Error', 'No se pudo eliminar')
        });
      }
    });
  }
}
