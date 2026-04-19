import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClienteService } from '../../services/cliente.service';
import { Cliente } from '../../models/cliente.model';

interface TableData {
  clienteID: string;
  nombreCompleto: string;
  documento: string;
  telefono: string;
  email: string;
  empresaId: string;
}

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [
    CommonModule,
    NzTableModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzDividerModule,
    NzCardModule,
    NzIconModule,
    ReactiveFormsModule
  ],
  template: `
    <nz-card nzTitle="Gestión de Clientes" class="clientes-card">
      <div class="table-header">
        <h3>Lista de Clientes</h3>
        <button nz-button nzType="primary" (click)="showCreateModal()" nzIcon="plus">
          Nuevo Cliente
        </button>
      </div>
      
      <nz-table #basicTable [nzData]="clientes()" [nzFrontPagination]="false" [nzShowPagination]="true" [nzPageSize]="10">
        <thead>
          <tr>
            <th>Nombres</th>
            <th>Documento</th>
            <th>Teléfono</th>
            <th>Email</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let data of basicTable.data">
            <td>{{data.nombreCompleto}}</td>
            <td>{{data.documento}}</td>
            <td>{{data.telefono}}</td>
            <td>{{data.email}}</td>
            <td>
              <a (click)="showEditModal(data)" style="margin-right: 8px"><i nz-icon nzType="edit"></i></a>
              <a nz-popconfirm nzPopconfirmTitle="¿Está seguro?" nzOkText="Sí" nzCancelText="No" (nzOnConfirm)="deleteCliente(data.clienteID)">
                <i nz-icon nzType="delete"></i>
              </a>
            </td>
          </tr>
        </tbody>
      </nz-table>

      <nz-modal [(nzVisible)]="isModalVisible" [nzTitle]="modalTitle" (nzOnCancel)="handleCancel()">
        <form nz-form [formGroup]="formGroup">
          <nz-form-item>
            <nz-form-label nzRequired>Nombres</nz-form-label>
            <nz-form-control>
              <input nz-input formControlName="nombre" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>Apellidos</nz-form-label>
            <nz-form-control>
              <input nz-input formControlName="apellido" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>Documento</nz-form-label>
            <nz-form-control>
              <input nz-input formControlName="documento" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>Teléfono</nz-form-label>
            <nz-form-control>
              <input nz-input formControlName="telefono" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>Email</nz-form-label>
            <nz-form-control>
              <input nz-input formControlName="email" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>Empresa ID</nz-form-label>
            <nz-form-control>
              <input nz-input formControlName="empresaId" />
            </nz-form-control>
          </nz-form-item>
        </form>
        <div nz-modal-footer>
          <button nz-button nzType="default" (click)="handleCancel()">Cancelar</button>
          <button nz-button nzType="primary" (click)="handleOk()" [disabled]="formGroup.invalid">Guardar</button>
        </div>
      </nz-modal>
    </nz-card>
  `,
  styles: [`
    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
    a {
      cursor: pointer;
      color: #1890ff;
    }
    a:hover {
      color: #40a9ff;
    }
  `]
})
export class ClientesComponent implements OnInit {
  clienteService = inject(ClienteService);
  fb = inject(FormBuilder);
  
  clientes = signal<TableData[]>([]);
  isModalVisible = false;
  modalTitle = '';
  editingCliente: TableData | null = null;
  formGroup!: FormGroup;
  loading = false;

  ngOnInit(): void {
    this.loadClientes();
  }

  loadClientes(): void {
    this.loading = true;
    this.clienteService.getAll().subscribe({
      next: (clientes: Cliente[]) => {
        this.clientes.set(clientes.map(c => ({
          clienteID: c.clienteID,
          nombreCompleto: c.nombre + ' ' + c.apellido,
          documento: c.documento,
          telefono: c.telefono,
          email: c.email,
          empresaId: c.empresaId
        })));
        this.loading = false;
      },
      error: () => {
        console.error('Error loading clientes');
        this.loading = false;
      }
    });
  }

  showCreateModal(): void {
    this.editingCliente = null;
    this.modalTitle = 'Nuevo Cliente';
    this.formGroup = this.fb.group({
      nombre: ['', Validators.required],
      apellido: ['', Validators.required],
      documento: ['', Validators.required],
      telefono: [''],
      email: [''],
      empresaId: ['']
    });
    this.isModalVisible = true;
  }

  showEditModal(cliente: TableData): void {
    this.editingCliente = cliente;
    this.modalTitle = 'Editar Cliente';
    const names = cliente.nombreCompleto.split(' ', 2);
    this.formGroup = this.fb.group({
      nombre: [names[0], Validators.required],
      apellido: [names.slice(1).join(' ') || '', Validators.required],
      documento: [cliente.documento, Validators.required],
      telefono: [cliente.telefono],
      email: [cliente.email],
      empresaId: [cliente.empresaId]
    });
    this.isModalVisible = true;
  }

  handleOk(): void {
    if (this.formGroup.valid) {
      const formValue = this.formGroup.value;
      const clienteData = {
        nombre: formValue.nombre,
        apellido: formValue.apellido,
        documento: formValue.documento,
        telefono: formValue.telefono,
        email: formValue.email,
        empresaId: formValue.empresaId
      };

      if (this.editingCliente) {
        this.clienteService.update({
          clienteID: this.editingCliente.clienteID,
          ...clienteData
        }).subscribe({
          next: () => {
            this.loadClientes();
            this.handleCancel();
          },
          error: () => {}
        });
      } else {
        this.clienteService.create(clienteData).subscribe({
          next: () => {
            this.loadClientes();
            this.handleCancel();
          },
          error: () => {}
        });
      }
    }
  }

  deleteCliente(id: string): void {
    this.clienteService.delete(id).subscribe({
      next: () => this.loadClientes(),
      error: () => {}
    });
  }

  handleCancel(): void {
    this.isModalVisible = false;
    this.formGroup.reset();
  }
}

