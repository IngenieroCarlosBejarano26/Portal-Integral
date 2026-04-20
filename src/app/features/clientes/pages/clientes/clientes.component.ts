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
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
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
    ReactiveFormsModule,
  ],
  templateUrl: './clientes.component.html',
  styleUrl: './clientes.component.css'
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
        this.clientes.set(
          clientes.map((c) => ({
            clienteID: c.clienteID,
            nombreCompleto: c.nombre + ' ' + c.apellido,
            documento: c.documento,
            telefono: c.telefono,
            email: c.email,
            empresaId: c.empresaId,
          })),
        );
        this.loading = false;
      },
      error: () => {
        console.error('Error loading clientes');
        this.loading = false;
      },
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
      empresaId: [''],
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
      empresaId: [cliente.empresaId],
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
        empresaId: formValue.empresaId,
      };

      if (this.editingCliente) {
        this.clienteService
          .update({
            clienteID: this.editingCliente.clienteID,
            ...clienteData,
          })
          .subscribe({
            next: () => {
              this.loadClientes();
              this.handleCancel();
            },
            error: () => {},
          });
      } else {
        this.clienteService.create(clienteData).subscribe({
          next: () => {
            this.loadClientes();
            this.handleCancel();
          },
          error: () => {},
        });
      }
    }
  }

  deleteCliente(id: string): void {
    this.clienteService.delete(id).subscribe({
      next: () => this.loadClientes(),
      error: () => {},
    });
  }

  handleCancel(): void {
    this.isModalVisible = false;
    this.formGroup.reset();
  }
}
