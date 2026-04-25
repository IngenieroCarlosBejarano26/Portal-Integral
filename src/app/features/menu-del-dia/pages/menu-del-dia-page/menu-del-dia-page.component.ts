import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { AuthService } from '../../../../core/services/auth/authService';
import { ComunicacionService } from '../../services/comunicacion.service';
import { ConfiguracionEmailService } from '../../../configuracion-email/services/configuracion-email.service';
import { PlantillasCorreoService } from '../../../plantillas-correo/services/plantillas-correo.service';
import {
  buildMenuDiaCuerpoHtml,
  defaultMenuDiaVacio,
  MenuDiaSimple,
  parseMenuDiaCuerpoHtml
} from '../../utils/menu-dia-mail-builder';

@Component({
  selector: 'app-menu-del-dia-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    NzButtonModule,
    NzInputModule,
    NzIconModule,
    NzAlertModule,
    NzCardModule,
    NzStatisticModule,
    NzTagModule,
    NzRadioModule
  ],
  templateUrl: './menu-del-dia-page.component.html',
  styleUrl: './menu-del-dia-page.component.css'
})
export class MenuDelDiaPageComponent implements OnInit {
  private static readonly PlantillaMenuCodigo = 'menu-del-dia';

  /** Texto de ayuda en el input asunto; incluye claves con llaves, sin que Angular lo interprete. */
  readonly placeholderAsuntoEjemplo = 'Menú del día — {{FechaHoy}}';

  private authService = inject(AuthService);
  private comunicacion = inject(ComunicacionService);
  private configEmail = inject(ConfiguracionEmailService);
  private plantillas = inject(PlantillasCorreoService);
  private notification = inject(NzNotificationService);
  private modal = inject(NzModalService);

  /** Enviar, guardar plantilla y editar cuerpos (API comunicación + plantilla). */
  get puedeEditarMenu(): boolean {
    return this.authService.hasPermission('menu-del-dia:update');
  }

  smtpListo = false;
  comprobandoSmtp = true;
  cargandoPlantilla = true;

  asunto = 'Menú del día';
  cuerpoHtml = '';
  /** Formulario en claro; el HTML se genera y guarda comentario interno para reabrir. */
  menuSimple: MenuDiaSimple = defaultMenuDiaVacio();
  /** formulario: asistente sin HTML. html: edición cruda. */
  vista: 'formulario' | 'html' = 'formulario';
  /** true si el HTML en BD no trae el bloque de metadatos (plantilla antigua o editada a mano). */
  cuerpoSinAsistente = false;

  enviando = false;
  guardandoPlantilla = false;
  ultimo: { destinatarios: number; enviados: number; fallidos: number } | null = null;

  ngOnInit(): void {
    this.asunto = 'Menú del día — {{FechaHoy}}';
    this.menuSimple = defaultMenuDiaVacio();
    this.cuerpoHtml = buildMenuDiaCuerpoHtml(this.menuSimple);
    this.plantillas.obtenerPorCodigo(MenuDelDiaPageComponent.PlantillaMenuCodigo).subscribe({
      next: (p) => {
        this.cargandoPlantilla = false;
        if (p?.cuerpoHtml?.trim()) {
          this.cuerpoHtml = p.cuerpoHtml;
          const parsed = parseMenuDiaCuerpoHtml(p.cuerpoHtml);
          if (parsed) {
            this.menuSimple = parsed;
            this.actualizarCuerpoDesdeFormulario();
            this.vista = 'formulario';
            this.cuerpoSinAsistente = false;
          } else {
            this.cuerpoSinAsistente = true;
            this.vista = 'html';
          }
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

  private aplicarCuerpoTrasCarga(): void {
    const parsed = parseMenuDiaCuerpoHtml(this.cuerpoHtml);
    if (parsed) {
      this.menuSimple = parsed;
      this.actualizarCuerpoDesdeFormulario();
      this.vista = 'formulario';
      this.cuerpoSinAsistente = false;
    } else {
      this.cuerpoSinAsistente = (this.cuerpoHtml || '').trim().length > 0;
      this.vista = 'html';
    }
  }

  /** Regenera el HTML a partir de los textos (vista asistente). */
  actualizarCuerpoDesdeFormulario(): void {
    this.cuerpoHtml = buildMenuDiaCuerpoHtml(this.menuSimple);
    this.cuerpoSinAsistente = false;
  }

  /** Cambia entre asistente (texto en claro) y editor HTML. */
  cambioVista(nueva: 'formulario' | 'html'): void {
    if (nueva === 'html') {
      this.actualizarCuerpoDesdeFormulario();
      this.vista = 'html';
      return;
    }
    const parsed = parseMenuDiaCuerpoHtml(this.cuerpoHtml);
    if (parsed) {
      this.menuSimple = parsed;
      this.actualizarCuerpoDesdeFormulario();
      this.vista = 'formulario';
      this.cuerpoSinAsistente = false;
      return;
    }
    this.vista = 'html';
    this.modal.confirm({
      nzTitle: 'Cambiar al asistente',
      nzContent:
        'El HTML no proviene del asistente (plantilla antigua o edición en Plantillas de correo). Si continúas, se reemplaza por un menú con campos vacíos para que los rellenes en claro.',
      nzOkText: 'Usar asistente',
      nzOkType: 'primary',
      nzCancelText: 'Cancelar',
      nzOnOk: () => {
        this.menuSimple = defaultMenuDiaVacio();
        this.actualizarCuerpoDesdeFormulario();
        this.vista = 'formulario';
        this.cuerpoSinAsistente = false;
      }
    });
  }

  recargarPlantillaDesdeServidor(): void {
    this.cargandoPlantilla = true;
    this.plantillas.obtenerPorCodigo(MenuDelDiaPageComponent.PlantillaMenuCodigo).subscribe({
      next: (p) => {
        this.cargandoPlantilla = false;
        if (p?.cuerpoHtml?.trim()) {
          this.cuerpoHtml = p.cuerpoHtml;
          this.aplicarCuerpoTrasCarga();
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
    if (!this.puedeEditarMenu) {
      this.notification.warning('Sin permiso', 'Tu rol no puede modificar el menú del día.');
      return;
    }
    this.asunto = 'Menú del día — {{FechaHoy}}';
    this.menuSimple = defaultMenuDiaVacio();
    this.actualizarCuerpoDesdeFormulario();
    this.vista = 'formulario';
    this.cuerpoSinAsistente = false;
    this.notification.success('Listo', 'Se vació el menú. Completa el asistente o cambia a HTML si lo prefieres.');
  }

  guardarComoPlantillaMenu(): void {
    if (!this.puedeEditarMenu) {
      this.notification.warning('Sin permiso', 'Tu rol no puede guardar el menú en plantillas.');
      return;
    }
    if (this.vista === 'formulario') {
      this.actualizarCuerpoDesdeFormulario();
    }
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
    if (!this.puedeEditarMenu) {
      this.notification.warning('Sin permiso', 'Tu rol no puede enviar el menú del día.');
      return;
    }
    if (this.vista === 'formulario') {
      this.actualizarCuerpoDesdeFormulario();
    }
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
