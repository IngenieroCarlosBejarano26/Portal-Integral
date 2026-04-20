import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { ConfiguracionEmailService } from '../../services/configuracion-email.service';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { AuthService } from '../../../../core/services/auth/authService';

@Component({
  selector: 'app-configuracion-email-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzButtonModule,
    NzIconModule,
    NzSwitchModule,
    NzSelectModule,
    NzAlertModule,
    NzSpinModule,
    HasPermissionDirective
  ],
  templateUrl: './configuracion-email-page.component.html',
  styleUrl: './configuracion-email-page.component.css'
})
export class ConfiguracionEmailPageComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(ConfiguracionEmailService);
  private notification = inject(NzNotificationService);
  private authService = inject(AuthService);

  loading = false;
  saving = false;
  /** Existe ya configuración → se hace UPDATE; si no, INSERT. */
  configuracionId: string | null = null;
  /** Si ya hay password guardada el campo se vuelve opcional. */
  tienePassword = false;
  showPassword = false;

  /** Puertos SMTP comunes. El usuario puede teclear cualquiera. */
  puertosComunes = [
    { value: 587, label: '587 — STARTTLS (recomendado)' },
    { value: 465, label: '465 — SSL/TLS implícito' },
    { value: 25,  label: '25 — Sin cifrar (no recomendado)' },
    { value: 2525, label: '2525 — Alternativo (Mailtrap, SendGrid)' }
  ];

  form = this.fb.nonNullable.group({
    smtpHost:     ['', [Validators.required, Validators.maxLength(200), Validators.pattern(/^[a-zA-Z0-9.\-]+$/)]],
    smtpPort:     [587, [Validators.required, Validators.min(1), Validators.max(65535)]],
    smtpUsername: ['', [Validators.required, Validators.maxLength(200)]],
    smtpPassword: ['', [Validators.maxLength(200)]],   // requerida solo al crear (validación dinámica abajo)
    fromEmail:    ['', [Validators.required, Validators.email, Validators.maxLength(200)]],
    fromName:     ['', [Validators.required, Validators.maxLength(200), Validators.pattern(/^[\p{L}\s.,'\-]+$/u)]],
    enableSsl:    [true],
    activo:       [true]
  });

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.loading = true;
    this.service.obtenerActiva().subscribe({
      next: (cfg) => {
        if (cfg) {
          this.configuracionId = cfg.configuracionEmailId;
          this.tienePassword = cfg.tienePassword;
          this.form.patchValue({
            smtpHost: cfg.smtpHost,
            smtpPort: cfg.smtpPort,
            smtpUsername: cfg.smtpUsername,
            smtpPassword: '',
            fromEmail: cfg.fromEmail,
            fromName: cfg.fromName,
            enableSsl: cfg.enableSsl,
            activo: cfg.activo
          });
        } else {
          // Sin configuración → la password es obligatoria.
          this.form.controls.smtpPassword.addValidators(Validators.required);
          this.form.controls.smtpPassword.updateValueAndValidity();
        }
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.notification.error('Error', 'No se pudo cargar la configuración de correo.');
      }
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notification.warning('Formulario incompleto', 'Revisa los campos marcados.');
      return;
    }

    if (!this.canSave()) {
      this.notification.warning('Sin permiso', 'No tienes permiso para guardar la configuración.');
      return;
    }

    this.saving = true;
    const v = this.form.getRawValue();
    this.service.guardar({
      configuracionEmailId: this.configuracionId ?? undefined,
      smtpHost: v.smtpHost.trim(),
      smtpPort: v.smtpPort,
      smtpUsername: v.smtpUsername.trim(),
      smtpPassword: v.smtpPassword,        // puede venir vacío en update → backend conserva la actual
      fromEmail: v.fromEmail.trim(),
      fromName: v.fromName.trim(),
      enableSsl: v.enableSsl,
      activo: v.activo
    }).subscribe({
      next: (cfg) => {
        this.saving = false;
        this.configuracionId = cfg.configuracionEmailId;
        this.tienePassword = true;
        this.form.controls.smtpPassword.removeValidators(Validators.required);
        this.form.controls.smtpPassword.setValue('');
        this.form.controls.smtpPassword.updateValueAndValidity();
        this.notification.success('Guardado', 'Configuración SMTP actualizada.');
      },
      error: (err) => {
        this.saving = false;
        const msg = err?.error?.message ?? err?.error?.errors?.[0] ?? 'No se pudo guardar la configuración.';
        this.notification.error('Error', msg);
      }
    });
  }

  /** Helper: ¿el usuario puede guardar? (create o update según haya o no registro). */
  canSave(): boolean {
    return this.configuracionId
      ? this.authService.hasPermission('configuracion-email:update')
      : this.authService.hasPermission('configuracion-email:create');
  }
}
