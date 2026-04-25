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
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { AuthService } from '../../../../core/services/auth/authService';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PlantillasCorreoService, PlantillaEmailDto, GuardarPlantillaEmailDto } from '../../services/plantillas-correo.service';

/** Documentación de las plantillas que el backend reconoce por código fijo. */
export interface RefPlantillaSistema {
  codigo: string;
  titulo: string;
  cuando: string;
  asunto: string;
  /** Nombres sin llaves; al escribir en HTML usar doble llave, ej. NombreCliente → {{NombreCliente}} */
  placeholders: readonly string[];
  extra?: string;
}

export const REF_PLANTILLAS_SISTEMA: readonly RefPlantillaSistema[] = [
  {
    codigo: 'consumo-valera',
    titulo: 'Notificación al consumir',
    cuando: 'Se usa al confirmar un consumo de almuerzo con la valera (si la plantilla existe en BD; si no, el servidor usa un HTML predeterminado).',
    asunto: 'Puede ser texto fijo o con placeholders (mismas claves que el cuerpo).',
    placeholders: [
      'NombreCliente',
      'NombreClienteTexto',
      'FechaHora',
      'AlmuerzosUsados',
      'AlmuerzosRestantes',
      'TotalAlmuerzos',
      'CodigoValera',
      'Observaciones',
      'ResumenAlmuerzos'
    ],
    extra: 'ResumenAlmuerzos ya incluye HTML (negritas). FechaHora en hora Colombia.'
  },
  {
    codigo: 'valera-qr',
    titulo: 'Valera nueva + QR (correo al cliente)',
    cuando: 'Se usa al crear una valera y el cliente tiene email; se adjunta la imagen del QR. El cuerpo debe incluir <img src="cid:qr" ...> en el sitio deseado.',
    asunto: 'Ejemplo: Tu valera está lista — {{TotalAlmuerzos}} almuerzos disponibles',
    placeholders: [
      'NombreCliente',
      'NombreClienteTexto',
      'TotalAlmuerzos',
      'FechaVencimiento',
      'CodigoValera',
      'UrlEscaneo'
    ],
    extra: 'UrlEscaneo es la URL del QR (útil en un enlace). La imagen embebida sigue siendo cid:qr.'
  },
  {
    codigo: 'menu-del-dia',
    titulo: 'Difusión / menú del día',
    cuando: 'Se precarga en la pantalla "Menú del día" y en el envío masivo. Fechas en zona Colombia.',
    asunto: 'Ejemplo: Menú del día — {{FechaHoy}}',
    placeholders: [
      'NombreCliente',
      'NombreClienteTexto',
      'FechaHoy',
      'FechaHoyLarga'
    ],
    extra: 'NombreCliente se sustituye por destinatario. FechaHoy = dd/MM/yyyy; FechaHoyLarga = fecha con mes en letras (Colombia).'
  }
] as const;

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
    NzCollapseModule,
    HasPermissionDirective
  ],
  templateUrl: './plantillas-correo-page.component.html',
  styleUrl: './plantillas-correo-page.component.css'
})
export class PlantillasCorreoPageComponent implements OnInit {
  private service = inject(PlantillasCorreoService);
  private notification = inject(NzNotificationService);
  authService = inject(AuthService);

  readonly refSistema = REF_PLANTILLAS_SISTEMA;

  loading = false;
  saving = false;
  plantillas: PlantillaEmailDto[] = [];

  modalVisible = false;
  isNew = false;
  /** Panel de guía en el modal: true = sección de ayuda desplegada. */
  refPanelAbierto = false;
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
    this.refPanelAbierto = false;
    this.modalVisible = true;
  }

  abrirEditar(p: PlantillaEmailDto): void {
    this.isNew = false;
    this.editCodigo = p.codigo;
    this.editAsunto = p.asunto;
    this.editCuerpo = p.cuerpoHtml;
    this.refPanelAbierto = false;
    this.modalVisible = true;
  }

  cerrarModal(): void {
    this.modalVisible = false;
  }

  puedeGuardar(): boolean {
    return this.authService.hasPermission('plantillas-correo:update');
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

  /** Muestra {{Clave}} en pantalla (evita conflictos con el motor de plantillas de Angular). */
  ph(c: string): string {
    return '{{' + c + '}}';
  }

  resumenUso(codigo: string | undefined | null): string {
    if (!codigo) return '—';
    const n = (codigo || '').trim().toLowerCase();
    const r = this.refSistema.find((x) => x.codigo === n);
    return r ? r.titulo : 'Código personalizado (no vinculado a consumo, valera o menú en bloque).';
  }
}
