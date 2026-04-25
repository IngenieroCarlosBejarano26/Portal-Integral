import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { ComunicacionService } from '../../services/comunicacion.service';
import { ConfiguracionEmailService } from '../../../configuracion-email/services/configuracion-email.service';

@Component({
  selector: 'app-menu-del-dia-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzIconModule,
    NzAlertModule,
    NzCardModule,
    NzStatisticModule
  ],
  templateUrl: './menu-del-dia-page.component.html',
  styleUrl: './menu-del-dia-page.component.css'
})
export class MenuDelDiaPageComponent implements OnInit {
  private comunicacion = inject(ComunicacionService);
  private configEmail = inject(ConfiguracionEmailService);
  private notification = inject(NzNotificationService);
  private modal = inject(NzModalService);

  smtpListo = false;
  comprobandoSmtp = true;

  asunto = 'Menú del día';
  cuerpoHtml = '';
  enviando = false;
  ultimo: { destinatarios: number; enviados: number; fallidos: number } | null = null;

  ngOnInit(): void {
    this.cuerpoHtml = this.cuerpoPorDefecto();
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
    // Placeholder reemplazado en backend por destinatario (no es binding de Angular).
    return `<!DOCTYPE html>
<html><body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1f2937; line-height: 1.6;">
  <p>Hola <strong>{{NombreCliente}}</strong>,</p>
  <p>Compartimos nuestro <strong>menú del día</strong>:</p>
  <ul>
    <li>Entrada: …</li>
    <li>Plato fuerte: …</li>
    <li>Bebida: …</li>
  </ul>
  <p>¡Te esperamos!</p>
</body></html>`;
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
