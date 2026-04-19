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
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { RealtimeEvents } from '../../../../core/services/realtime/realtime-events';
import { EmpresaService, Empresa } from '../../services/empresa.service';

@Component({
  selector: 'app-empresas-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    CardGridComponent
  ],
  templateUrl: './empresas-list.component.html',
  styleUrl: './empresas-list.component.css'
})
export class EmpresasListComponent implements OnInit, OnDestroy {
  private empresaService = inject(EmpresaService);
  private notification = inject(NzNotificationService);
  private modal = inject(NzModalService);
  private realtime = inject(RealtimeService);
  private destroy$ = new Subject<void>();

  empresas: Empresa[] = [];
  filteredEmpresas: Empresa[] = [];
  loading = false;
  searchValue = '';

  cardConfig: CardConfig = {
    titleKey: 'nombre',
    iconType: 'shop',
    fields: [
      { key: 'fechaCreacion', label: 'Creada', icon: 'calendar', format: (v) => v ? new Date(v).toLocaleDateString('es-CO') : '—' }
    ]
  };

  cardActions: CardAction[] = [
    { label: 'Editar', icon: 'edit', action: (item) => this.openForm(item) },
    { label: 'Eliminar', icon: 'delete', color: 'danger', action: (item) => this.deleteEmpresa(item) }
  ];

  fields: FormField[] = [
    { key: 'nombre', label: 'Nombre de la Empresa', type: 'text', required: true, placeholder: 'Ej. Ancestrales SAS' }
  ];

  ngOnInit(): void {
    this.loadEmpresas();
    this.subscribeToRealtimeEvents();
  }

  private subscribeToRealtimeEvents(): void {
    const reload = () => this.loadEmpresas();
    this.realtime.on(RealtimeEvents.Empresa.Created).pipe(takeUntil(this.destroy$)).subscribe(reload);
    this.realtime.on(RealtimeEvents.Empresa.Updated).pipe(takeUntil(this.destroy$)).subscribe(reload);
    this.realtime.on(RealtimeEvents.Empresa.Deleted).pipe(takeUntil(this.destroy$)).subscribe(reload);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadEmpresas(): void {
    this.loading = true;
    this.empresaService.loadEmpresas()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (empresas) => {
          this.empresas = empresas;
          this.filterEmpresas();
          this.loading = false;
        },
        error: () => { this.loading = false; }
      });
  }

  onSearch(value: string): void {
    this.searchValue = value.toLowerCase();
    this.filterEmpresas();
  }

  private filterEmpresas(): void {
    if (!this.searchValue) {
      this.filteredEmpresas = [...this.empresas];
    } else {
      this.filteredEmpresas = this.empresas.filter(e =>
        e.nombre?.toLowerCase().includes(this.searchValue)
      );
    }
  }

  onReload(): void { this.loadEmpresas(); }

  openForm(empresa?: Empresa): void {
    const isEdit = !!empresa;
    const modalRef = this.modal.create({
      nzTitle: isEdit ? 'Editar Empresa' : 'Nueva Empresa',
      nzContent: FormModalComponent,
      nzData: { fields: this.fields, initialValue: empresa, mode: isEdit ? 'edit' : 'create' },
      nzFooter: null,
      nzWidth: 600,
      nzCentered: true
    });

    modalRef.afterClose.subscribe((result) => {
      if (!result) return;
      const obs = isEdit
        ? this.empresaService.updateEmpresa({ ...result, empresaId: empresa!.empresaId })
        : this.empresaService.createEmpresa(result);
      obs.subscribe({
        next: () => {
          this.notification.success('Éxito', `Empresa ${isEdit ? 'actualizada' : 'creada'} correctamente`);
          this.loadEmpresas();
        },
        error: () => this.notification.error('Error', 'No se pudo procesar la solicitud')
      });
    });
  }

  deleteEmpresa(empresa: Empresa): void {
    this.modal.confirm({
      nzTitle: '¿Eliminar empresa?',
      nzContent: `¿Estás seguro de eliminar "${empresa.nombre}"?`,
      nzOkText: 'Eliminar',
      nzOkDanger: true,
      nzCancelText: 'Cancelar',
      nzOnOk: () => {
        if (!empresa.empresaId) return;
        this.empresaService.deleteEmpresa(empresa.empresaId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.notification.success('Éxito', 'Empresa eliminada');
              this.loadEmpresas();
            },
            error: () => this.notification.error('Error', 'No se pudo eliminar')
          });
      }
    });
  }
}
