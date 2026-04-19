import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth/authService';
import { FormModalComponent, FormField } from '../../../../shared/components/form-modal/form-modal.component';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule
  ],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css'
})
export class PerfilComponent implements OnInit {
  private authService = inject(AuthService);
  private modal = inject(NzModalService);
  private notification = inject(NzNotificationService);
  private router = inject(Router);

  user: any = null;
  tenantName = '—';
  tenantId = '—';
  rolNombre = '—';
  email = '—';
  usuarioId = '—';
  nombreUsuario = '—';
  initials = '?';
  sessionStart = '—';
  tokenExpires = '—';

  ngOnInit(): void {
    this.user = this.authService.getCurrentUser() || {};
    this.parseTokenInfo();
    this.computeInitials();
  }

  private parseTokenInfo(): void {
    const token = this.authService.getToken();
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));

      // Claims estándar JWT
      this.usuarioId = payload.sub || this.user?.usuarioId || '—';
      this.nombreUsuario =
        payload.unique_name || payload.name || this.user?.nombreUsuario || '—';
      this.email = payload.email || this.user?.email || '—';

      // Claims personalizados del backend
      this.tenantId = payload.tenantId || payload.tid || '—';
      this.tenantName = payload.tenantNombre || payload.tenant || '—';
      this.rolNombre =
        payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
        payload.role || payload.rol || '—';

      // Tiempo
      if (payload.iat) {
        this.sessionStart = new Date(payload.iat * 1000).toLocaleString('es-CO');
      }
      if (payload.exp) {
        this.tokenExpires = new Date(payload.exp * 1000).toLocaleString('es-CO');
      }

      // Sincronizar user para que el HTML siempre muestre algo
      this.user = {
        ...this.user,
        usuarioId: this.usuarioId,
        nombreUsuario: this.nombreUsuario,
        email: this.email
      };
    } catch (err) {
      console.warn('No se pudo decodificar el JWT:', err);
    }
  }

  private computeInitials(): void {
    const name = this.nombreUsuario !== '—'
      ? this.nombreUsuario
      : (this.user?.nombreUsuario || this.user?.email || '?');
    this.initials = name.toString().substring(0, 2).toUpperCase();
  }

  editProfile(): void {
    const fields: FormField[] = [
      { key: 'nombreUsuario', label: 'Nombre de usuario', type: 'text', required: true, span: 12 },
      { key: 'email', label: 'Email', type: 'email', span: 12 }
    ];

    this.modal.create({
      nzTitle: 'Editar Perfil',
      nzContent: FormModalComponent,
      nzData: { fields, initialValue: this.user, mode: 'edit' },
      nzFooter: null,
      nzWidth: 520,
      nzCentered: true
    }).afterClose.subscribe((result) => {
      if (!result) return;
      this.notification.info('Pendiente', 'La actualización del perfil estará disponible pronto');
    });
  }

  changePassword(): void {
    const fields: FormField[] = [
      { key: 'actual', label: 'Contraseña actual', type: 'password', required: true },
      { key: 'nueva', label: 'Nueva contraseña', type: 'password', required: true, span: 12 },
      { key: 'confirmar', label: 'Confirmar contraseña', type: 'password', required: true, span: 12 }
    ];

    this.modal.create({
      nzTitle: 'Cambiar contraseña',
      nzContent: FormModalComponent,
      nzData: { fields, mode: 'edit' },
      nzFooter: null,
      nzWidth: 520,
      nzCentered: true
    }).afterClose.subscribe((result) => {
      if (!result) return;
      if (result.nueva !== result.confirmar) {
        this.notification.error('Error', 'Las contraseñas no coinciden');
        return;
      }
      this.notification.info('Pendiente', 'El cambio de contraseña estará disponible pronto');
    });
  }

  logout(): void {
    this.modal.confirm({
      nzTitle: '¿Cerrar sesión?',
      nzContent: 'Tendrás que volver a iniciar sesión para acceder al portal.',
      nzOkText: 'Cerrar sesión',
      nzOkDanger: true,
      nzCancelText: 'Cancelar',
      nzOnOk: () => this.authService.logout()
    });
  }
}
