import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { AuthService } from '../../../../core/services/auth/authService';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PlantillasCorreoService, PlantillaEmailDto, GuardarPlantillaEmailDto } from '../../services/plantillas-correo.service';

@Component({
  selector: 'app-plantillas-correo-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzTableModule,
    NzIconModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzSpinModule,
    NzTagModule,
    NzAlertModule,
    HasPermissionDirective
  ],
  templateUrl: './plantillas-correo-page.component.html',
  styleUrl: './plantillas-correo-page.component.css'
})
export class PlantillasCorreoPageComponent implements OnInit {
  private service = inject(PlantillasCorreoService);
  private notification = inject(NzNotificationService);
  authService = inject(AuthService);

  loading = false;
  saving = false;
  plantillas: PlantillaEmailDto[] = [];

  modalVisible = false;
  isNew = false;
  editCodigo = '';
  editAsunto = '';
  editCuerpo = '';

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.service.listar().subscribe({
      next: (rows) => {
        this.plantillas = rows;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.notification.error('Error', 'No se pudieron cargar las plantillas.');
      }
    });
  }

  abrirNueva(): void {
    this.isNew = true;
    this.editCodigo = '';
    this.editAsunto = '';
    this.editCuerpo = this.plantillaHtmlVacia();
    this.modalVisible = true;
  }

  abrirEditar(p: PlantillaEmailDto): void {
    this.isNew = false;
    this.editCodigo = p.codigo;
    this.editAsunto = p.asunto;
    this.editCuerpo = p.cuerpoHtml;
    this.modalVisible = true;
  }

  cerrarModal(): void {
    this.modalVisible = false;
  }

  puedeGuardar(): boolean {
    return this.authService.hasPermission(['configuracion-email:update', 'configuracion-email:create']);
  }

  /** El modal espera la promesa para mantener el loading y no cerrar antes de tiempo. */
  guardar(): Promise<void> {
    const codigo = (this.editCodigo || '').trim();
    if (!codigo) {
      this.notification.warning('Código requerido', 'Indica un código único (ej. menu-del-dia).');
      return Promise.reject();
    }
    if (!this.editAsunto.trim() || !this.editCuerpo.trim()) {
      this.notification.warning('Datos incompletos', 'Asunto y cuerpo son obligatorios.');
      return Promise.reject();
    }
    const dto: GuardarPlantillaEmailDto = {
      codigo,
      asunto: this.editAsunto.trim(),
      cuerpoHtml: this.editCuerpo
    };
    this.saving = true;
    return new Promise((resolve, reject) => {
      this.service.guardar(dto).subscribe({
        next: (ok) => {
          this.saving = false;
          if (ok) {
            this.notification.success('Guardado', 'Plantilla guardada correctamente.');
            this.modalVisible = false;
            this.cargar();
            resolve();
          } else {
            this.notification.error('Error', 'No se pudo guardar.');
            reject();
          }
        },
        error: (err) => {
          this.saving = false;
          const msg = err?.error?.message || 'Error al guardar.';
          this.notification.error('Error', msg);
          reject();
        }
      });
    });
  }

  private plantillaHtmlVacia(): string {
    return `<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; color: #1f2937;">
<p>Hola <strong>{{NombreCliente}}</strong>,</p>
<p>Tu mensaje aquí.</p>
</body></html>`;
  }
}
