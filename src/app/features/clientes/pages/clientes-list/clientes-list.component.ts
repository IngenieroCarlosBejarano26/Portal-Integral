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
import { ClienteService, Cliente } from '../../services/cliente.service';
import { EmpresaService, Empresa } from '../../../empresas/services/empresa.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { RealtimeEvents } from '../../../../core/services/realtime/realtime-events';

@Component({
  selector: 'app-clientes-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    CardGridComponent
  ],
  templateUrl: './clientes-list.component.html',
  styleUrl: './clientes-list.component.css'
})
export class ClientesListComponent implements OnInit, OnDestroy {
private clienteService = inject(ClienteService);
private empresaService = inject(EmpresaService);
private notification = inject(NzNotificationService);
private modal = inject(NzModalService);
private realtime = inject(RealtimeService);
private destroy$ = new Subject<void>();

clientes: Cliente[] = [];
filteredClientes: Cliente[] = [];
loading = false;
searchValue = '';
private empresaField: FormField = {
  key: 'empresaId', label: 'Empresa', type: 'select', required: true, span: 12,
  placeholder: 'Selecciona una empresa', options: []
};

  cardConfig: CardConfig = {
    titleKey: 'nombre',
    subtitleKey: 'email',
    statusKey: 'activo',
    fields: [
      { key: 'documento', label: 'Documento', icon: 'idcard' },
      { key: 'telefono', label: 'Teléfono', icon: 'phone' }
    ]
  };

  cardActions: CardAction[] = [
    { label: 'Editar', icon: 'edit', action: (item) => this.openForm(item) },
    { label: 'Eliminar', icon: 'delete', color: 'danger', action: (item) => this.deleteCliente(item) }
  ];

  fields: FormField[] = [
    { key: 'nombre', label: 'Nombre', type: 'text', required: true, span: 12 },
    { key: 'apellido', label: 'Apellido', type: 'text', required: true, span: 12 },
    { key: 'documento', label: 'Documento', type: 'text', required: true, span: 12 },
    { key: 'telefono', label: 'Teléfono', type: 'text', required: true, span: 12 },
    { key: 'email', label: 'Email', type: 'email', required: true, span: 12 },
    this.empresaField
  ];

  ngOnInit(): void {
    this.loadClientes();
    this.loadEmpresaOptions();
    const reload = () => this.loadClientes();
    this.realtime.on(RealtimeEvents.Cliente.Created).pipe(takeUntil(this.destroy$)).subscribe(reload);
    this.realtime.on(RealtimeEvents.Cliente.Updated).pipe(takeUntil(this.destroy$)).subscribe(reload);
    this.realtime.on(RealtimeEvents.Cliente.Deleted).pipe(takeUntil(this.destroy$)).subscribe(reload);
    // Mantener las opciones de Empresa actualizadas en tiempo real
    const reloadEmpresas = () => this.loadEmpresaOptions();
    this.realtime.on(RealtimeEvents.Empresa.Created).pipe(takeUntil(this.destroy$)).subscribe(reloadEmpresas);
    this.realtime.on(RealtimeEvents.Empresa.Updated).pipe(takeUntil(this.destroy$)).subscribe(reloadEmpresas);
    this.realtime.on(RealtimeEvents.Empresa.Deleted).pipe(takeUntil(this.destroy$)).subscribe(reloadEmpresas);
  }

  private loadEmpresaOptions(): void {
    this.empresaService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe((empresas: Empresa[]) => {
        this.empresaField.options = empresas
          .filter(e => !!e.empresaId)
          .map(e => ({ label: e.nombre ?? e.empresaId!, value: e.empresaId! }));
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadClientes(): void {
    this.loading = true;
    this.clienteService.loadClientes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (clientes) => {
          this.clientes = clientes;
          this.filterClientes();
          this.loading = false;
        },
        error: () => { this.loading = false; }
      });
  }

  onSearch(value: string): void {
    this.searchValue = value.toLowerCase();
    this.filterClientes();
  }

  private filterClientes(): void {
    if (!this.searchValue) {
      this.filteredClientes = [...this.clientes];
    } else {
      this.filteredClientes = this.clientes.filter(c =>
        c.nombre?.toLowerCase().includes(this.searchValue) ||
        c.email?.toLowerCase().includes(this.searchValue) ||
        c.telefono?.includes(this.searchValue) ||
        c.documento?.includes(this.searchValue)
      );
    }
  }

  onReload(): void { this.loadClientes(); }

  openForm(cliente?: Cliente): void {
    const isEdit = !!cliente;
    const modalRef = this.modal.create({
      nzTitle: isEdit ? 'Editar Cliente' : 'Nuevo Cliente',
      nzContent: FormModalComponent,
      nzData: { fields: this.fields, initialValue: cliente, mode: isEdit ? 'edit' : 'create' },
      nzFooter: null,
      nzWidth: 600,
      nzCentered: true
    });

    modalRef.afterClose.subscribe((result) => {
      if (!result) return;
      const obs = isEdit
        ? this.clienteService.updateCliente({ ...result, clienteID: cliente!.clienteID })
        : this.clienteService.createCliente(result);
      obs.subscribe({
        next: () => {
          this.notification.success('Éxito', `Cliente ${isEdit ? 'actualizado' : 'creado'} correctamente`);
          this.loadClientes();
        },
        error: () => this.notification.error('Error', 'No se pudo procesar la solicitud')
      });
    });
  }

  deleteCliente(cliente: Cliente): void {
    this.modal.confirm({
      nzTitle: '¿Eliminar cliente?',
      nzContent: `¿Estás seguro de eliminar a "${cliente.nombre}"?`,
      nzOkText: 'Eliminar',
      nzOkDanger: true,
      nzCancelText: 'Cancelar',
      nzOnOk: () => {
        if (!cliente.clienteID) return;
        this.clienteService.deleteCliente(cliente.clienteID)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.notification.success('Éxito', 'Cliente eliminado');
              this.loadClientes();
            },
            error: () => this.notification.error('Error', 'No se pudo eliminar')
          });
      }
    });
  }
}
