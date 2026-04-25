import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ComunicacionService } from '../../services/comunicacion.service';
import { ConfiguracionEmailService } from '../../../configuracion-email/services/configuracion-email.service';
import { PlantillasCorreoService } from '../../../plantillas-correo/services/plantillas-correo.service';

@Component({
  selector: 'app-menu-del-dia-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzIconModule,
    NzAlertModule,
    NzCardModule,
    NzStatisticModule,
    NzTagModule
  ],
  templateUrl: './menu-del-dia-page.component.html',
  styleUrl: './menu-del-dia-page.component.css'
})
export class MenuDelDiaPageComponent implements OnInit {
  private static readonly PlantillaMenuCodigo = 'menu-del-dia';

  /** Texto de ayuda en el input asunto; incluye claves con llaves, sin que Angular lo interprete. */
  readonly placeholderAsuntoEjemplo = 'Menú del día — {{FechaHoy}}';

  private comunicacion = inject(ComunicacionService);
  private configEmail = inject(ConfiguracionEmailService);
  private plantillas = inject(PlantillasCorreoService);
  private notification = inject(NzNotificationService);
  private modal = inject(NzModalService);

  smtpListo = false;
  comprobandoSmtp = true;
  cargandoPlantilla = true;

  asunto = 'Menú del día';
  cuerpoHtml = '';
  enviando = false;
  guardandoPlantilla = false;
  ultimo: { destinatarios: number; enviados: number; fallidos: number } | null = null;

  ngOnInit(): void {
    this.asunto = 'Menú del día — {{FechaHoy}}';
    this.cuerpoHtml = this.cuerpoPorDefecto();
    this.plantillas.obtenerPorCodigo(MenuDelDiaPageComponent.PlantillaMenuCodigo).subscribe({
      next: (p) => {
        this.cargandoPlantilla = false;
        if (p?.cuerpoHtml?.trim()) {
          this.cuerpoHtml = p.cuerpoHtml;
        }
        if (p?.asunto?.trim()) {
          this.asunto = p.asunto;
        }
      },
      error: () => {
        this.cargandoPlantilla = false;
      }
    });
    this.configEmail.obtenerActiva().subscribe({
      next: (cfg) => {
        this.smtpListo = !!cfg?.activo;
        this.comprobandoSmtp = false;
      },
      error: () => {
        this.smtpListo = false;
        this.comprobandoSmtp = false;
      }
    });
  }

  private cuerpoPorDefecto(): string {
    // Placeholders reemplazados en el servidor al enviar (no son binding de Angular).
    return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1f2937; line-height: 1.6; max-width: 560px; margin: 0 auto; padding: 16px;">
  <p style="color: #6b7280; font-size: 13px; margin: 0 0 8px 0;">{{FechaHoyLarga}}</p>
  <p>Hola <strong>{{NombreCliente}}</strong>,</p>
  <p>Compartimos nuestro <strong>menú del día</strong> ({{FechaHoy}}):</p>
  <ul>
    <li>Entrada: …</li>
    <li>Plato fuerte: …</li>
    <li>Bebida: …</li>
  </ul>
  <p>¡Te esperamos!</p>
  <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">Mensaje automático. Por favor no respondas a este correo.</p>
</body></html>`;
  }

  recargarPlantillaDesdeServidor(): void {
    this.cargandoPlantilla = true;
    this.plantillas.obtenerPorCodigo(MenuDelDiaPageComponent.PlantillaMenuCodigo).subscribe({
      next: (p) => {
        this.cargandoPlantilla = false;
        if (p?.cuerpoHtml?.trim()) {
          this.cuerpoHtml = p.cuerpoHtml;
        } else {
          this.notification.info('Plantilla en servidor', 'No hay plantilla guardada con código menu-del-dia.');
        }
        if (p?.asunto?.trim()) {
          this.asunto = p.asunto;
        }
      },
      error: () => {
        this.cargandoPlantilla = false;
        this.notification.error('Error', 'No se pudo cargar la plantilla.');
      }
    });
  }

  restaurarTextoDeEjemplo(): void {
    this.asunto = 'Menú del día — {{FechaHoy}}';
    this.cuerpoHtml = this.cuerpoPorDefecto();
    this.notification.success('Listo', 'Se restauró el texto de ejemplo. Puedes editarlo antes de enviar o guardar.');
  }

  guardarComoPlantillaMenu(): void {
    if (!this.asunto.trim() || !this.cuerpoHtml.trim()) {
      this.notification.warning('Faltan datos', 'Completa asunto y cuerpo antes de guardar la plantilla.');
      return;
    }
    this.guardandoPlantilla = true;
    this.plantillas
      .guardar({
        codigo: MenuDelDiaPageComponent.PlantillaMenuCodigo,
        asunto: this.asunto.trim(),
        cuerpoHtml: this.cuerpoHtml
      })
      .subscribe({
        next: (ok) => {
          this.guardandoPlantilla = false;
          if (ok) {
            this.notification.success('Plantilla guardada', 'La próxima vez que abras Menú del día o Plantillas, verás este texto (código menu-del-dia).');
          } else {
            this.notification.error('No se pudo guardar', 'Revisa permisos o vuelve a intentar.');
          }
        },
        error: (err) => {
          this.guardandoPlantilla = false;
          const msg = err?.error?.message || err?.message || 'Error al guardar plantilla.';
          this.notification.error('Error', msg);
        }
      });
  }

  confirmarYEnviar(): void {
    if (!this.asunto.trim() || !this.cuerpoHtml.trim()) {
      this.notification.warning('Faltan datos', 'Completa asunto y cuerpo del mensaje.');
      return;
    }
    this.modal.confirm({
      nzTitle: '¿Enviar a todos los clientes con email?',
      nzContent:
        'Se enviará un correo a cada cliente activo que tenga dirección de email registrada. Esta acción no se puede deshacer.',
      nzOkText: 'Enviar ahora',
      nzOkType: 'primary',
      nzCancelText: 'Cancelar',
      nzOnOk: () => this.ejecutarEnvio()
    });
  }

  private ejecutarEnvio(): Promise<void> {
    this.enviando = true;
    this.ultimo = null;
    return new Promise((resolve, reject) => {
      this.comunicacion
        .enviarMenuDelDia({ asunto: this.asunto.trim(), cuerpoHtml: this.cuerpoHtml })
        .subscribe({
          next: (res) => {
            this.enviando = false;
            this.ultimo = {
              destinatarios: res.destinatarios,
              enviados: res.enviados,
              fallidos: res.fallidos
            };
            this.notification.success(
              'Envío finalizado',
              `${res.enviados} enviados, ${res.fallidos} fallidos, de ${res.destinatarios} con email.`
            );
            resolve();
          },
          error: (err) => {
            this.enviando = false;
            const msg = err?.error?.message || err?.message || 'Error al enviar.';
            this.notification.error('No se pudo enviar', msg);
            reject();
          }
        });
    });
  }
}
