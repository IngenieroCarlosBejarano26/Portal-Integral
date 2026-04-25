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
import { UsuarioService, Usuario, RegistrarUsuario, ActualizarUsuario } from '../../services/usuario.service';
import { RolService, Rol } from '../../../roles/services/rol.service';
import { AuthService } from '../../../../core/services/auth/authService';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { RealtimeEvents } from '../../../../core/services/realtime/realtime-events';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { PlanService } from '../../../planes/services/plan.service';

@Component({
  selector: 'app-usuarios-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzToolTipModule,
    CardGridComponent,
    HasPermissionDirective
  ],
  templateUrl: './usuarios-list.component.html',
  styleUrl: './usuarios-list.component.css'
})
export class UsuariosListComponent implements OnInit, OnDestroy {
  private usuarioService = inject(UsuarioService);
  private rolService = inject(RolService);
  private authService = inject(AuthService);
  private modal = inject(NzModalService);
  private notification = inject(NzNotificationService);
  private realtime = inject(RealtimeService);
  private planService = inject(PlanService);
  private destroy$ = new Subject<void>();

  /** True si el plan del tenant esta vencido => bloqueo de creacion. */
  planVencido = false;

  usuarios: Usuario[] = [];
  filteredUsuarios: Usuario[] = [];
  loading = false;
  searchValue = '';
  private tenantId: string | null = null;

  private rolField: FormField = {
    key: 'rolId', label: 'Rol', type: 'select', required: true, span: 24,
    placeholder: 'Selecciona un rol', options: []
  };

  cardConfig: CardConfig = {
    titleKey: 'nombreUsuario',
    subtitleKey: 'email',
    iconType: 'user',
    statusKey: 'activo',
    fields: [
      { key: 'rol', label: 'Rol', icon: 'safety', format: (v) => v || '—' },
      { key: 'tenant', label: 'Tenant', icon: 'bank', format: (v) => v || '—' },
      { key: 'fechaCreacion', label: 'Creado', icon: 'calendar',
        format: (v) => v ? new Date(v).toLocaleDateString('es-CO') : '—' }
    ]
  };

  /**
   * Acciones por tarjeta. Solo aparecen si el usuario actual es Admin.
   * `visible` se ejecuta por cada item: aquí gobernamos la visibilidad por rol.
   */
  cardActions: CardAction[] = [
    {
      label: 'Editar', icon: 'edit',
      visible: () => this.authService.hasPermission('usuarios:update'),
      action: (item) => this.openEditForm(item as Usuario)
    },
    {
      label: 'Eliminar', icon: 'delete', color: 'danger',
      visible: (item) => this.authService.hasPermission('usuarios:delete')
        && (item as Usuario).activo !== false,
      action: (item) => this.deleteUsuario(item as Usuario)
    }
  ];

  /**
   * Campos del formulario.
   * - password / confirmarPassword: solo en CREAR.
   * - activo: solo en EDITAR (al crear siempre se activa por defecto).
   */
  fields: FormField[] = [
    {
      key: 'nombreUsuario', label: 'Nombre de usuario', type: 'text', required: true, span: 12,
      placeholder: 'jperez',
      minLength: 3, maxLength: 50,
      pattern: /^[a-zA-Z0-9._-]+$/,
      errorMessages: {
        required: 'El nombre de usuario es obligatorio.',
        minlength: 'Mínimo 3 caracteres.',
        maxlength: 'Máximo 50 caracteres.',
        pattern: 'Solo letras, números, puntos, guiones y guiones bajos.'
      }
    },
    {
      key: 'email', label: 'Email', type: 'email', required: true, span: 12,
      placeholder: 'usuario@dominio.com',
      maxLength: 254,
      errorMessages: {
        required: 'El email es obligatorio.',
        email: 'Formato de email no válido.',
        maxlength: 'Máximo 254 caracteres.',
        pattern: 'El email debe ser una dirección válida (ej: usuario@dominio.com).'
      }
    },
    {
      key: 'password', label: 'Contraseña', type: 'password', required: true, span: 12,
      placeholder: '••••••••', mode: 'create',
      minLength: 8, maxLength: 100,
      // hint: 'Mínimo 8 caracteres con mayúsculas, minúsculas, números y un símbolo.',
      errorMessages: {
        required: 'La contraseña es obligatoria.',
        minlength: 'Mínimo 8 caracteres.',
        pattern: 'La contraseña debe tener mayúsculas, minúsculas, números y símbolos.'
      }
    },
    {
      key: 'confirmarPassword', label: 'Confirmar contraseña', type: 'password', required: true, span: 12,
      placeholder: '••••••••', mode: 'create',
      minLength: 8, maxLength: 100,
      errorMessages: {
        required: 'Debes confirmar la contraseña.'
      }
    },
    this.rolField,
    { key: 'activo', label: 'Usuario activo', type: 'switch', span: 24, mode: 'edit' }
  ];

  ngOnInit(): void {
    this.tenantId = this.extractTenantIdFromToken();
    this.loadAll();
    this.loadRoleOptions();

    const reload = () => this.loadAll();
    this.realtime.on(RealtimeEvents.Usuario.Created).pipe(takeUntil(this.destroy$)).subscribe(reload);
    this.realtime.on(RealtimeEvents.Usuario.Updated).pipe(takeUntil(this.destroy$)).subscribe(reload);

    const reloadRoles = () => this.loadRoleOptions();
    this.realtime.on(RealtimeEvents.Rol.Created).pipe(takeUntil(this.destroy$)).subscribe(reloadRoles);
    this.realtime.on(RealtimeEvents.Rol.Updated).pipe(takeUntil(this.destroy$)).subscribe(reloadRoles);
    this.realtime.on(RealtimeEvents.Rol.Deleted).pipe(takeUntil(this.destroy$)).subscribe(reloadRoles);

    // Estado de vigencia del plan: bloquea el boton "Nuevo Usuario" si esta vencido.
    this.planService.plan$
      .pipe(takeUntil(this.destroy$))
      .subscribe(p => this.planVencido = p?.estadoPlan === 'Vencido');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Obtiene el tenantId del JWT decodificándolo de forma robusta (soporta base64url).
   * Primero intenta usar `authService.getCurrentUser().tenantId` si está disponible.
   */
  private extractTenantIdFromToken(): string | null {
    const fromUser = this.authService.getCurrentUser()?.tenantId;
    if (fromUser) return fromUser;

    const token = this.authService.getToken();
    if (!token) return null;

    try {
      let payload = token.split('.')[1] ?? '';
      // base64url → base64 estándar
      payload = payload.replace(/-/g, '+').replace(/_/g, '/');
      // padding
      const pad = payload.length % 4;
      if (pad) payload += '='.repeat(4 - pad);

      const decoded = JSON.parse(atob(payload));
      return decoded.tenantId || decoded.tid || null;
    } catch (e) {
      console.error('[Usuarios] No se pudo decodificar el JWT:', e);
      return null;
    }
  }


  private loadAll(): void {
    if (!this.tenantId) {
      this.notification.warning('Sin tenant', 'No se pudo determinar el tenant del usuario actual.');
      return;
    }
    this.loading = true;
    this.usuarioService.getUsuariosByTenant(this.tenantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.usuarios = data;
          this.applyFilter();
          this.loading = false;
        },
        error: () => { this.loading = false; }
      });
  }

  private loadRoleOptions(): void {
    this.rolService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe((roles: Rol[]) => {
        this.rolField.options = roles
          .filter(r => !!r.rolId)
          .map(r => ({ label: r.nombre ?? '—', value: r.rolId! }));

        if (this.rolField.options.length === 0) {
          console.warn('[Usuarios] No se encontraron roles disponibles. Ve a /roles y crea al menos uno.');
        }
      });
  }

  onSearch(value: string): void {
    this.searchValue = (value || '').toLowerCase();
    this.applyFilter();
  }

  private applyFilter(): void {
    const term = this.searchValue;
    if (!term) {
      this.filteredUsuarios = [...this.usuarios];
      return;
    }
    this.filteredUsuarios = this.usuarios.filter(u =>
      u.nombreUsuario?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.rol?.toLowerCase().includes(term)
    );
  }

  onReload(): void { this.loadAll(); }

  openForm(): void {
    if (!this.tenantId) {
      this.notification.warning('Sin tenant', 'No se pudo determinar el tenant del usuario actual.');
      return;
    }
    if (!this.rolField.options || this.rolField.options.length === 0) {
      this.notification.warning('Sin roles',
        'No hay roles disponibles. Crea al menos un rol antes de registrar usuarios.');
      return;
    }

    const modalRef = this.modal.create({
      nzTitle: 'Nuevo Usuario',
      nzContent: FormModalComponent,
      nzData: {
        fields: this.fields,
        mode: 'create',
        // Hint visual sobre las reglas de password del backend
        helpText: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial (!@#$%^&*...)'
      },
      nzFooter: null,
      nzWidth: 640,
      nzCentered: true
    });

    modalRef.afterClose.subscribe((result) => {
      if (!result) return;

      // Validación cliente: contraseñas deben coincidir (sin trim para no enmascarar errores reales)
      if (result.password !== result.confirmarPassword) {
        this.notification.error('Validación', 'Las contraseñas no coinciden.');
        return;
      }

      const payload: RegistrarUsuario = {
        nombreUsuario: (result.nombreUsuario ?? '').trim(),
        email: (result.email ?? '').trim(),
        password: result.password ?? '',
        confirmarPassword: result.confirmarPassword ?? '',
        rolId: result.rolId,
        tenantId: this.tenantId!
      };

      this.usuarioService.registrar(payload).subscribe({
        next: (u) => {
          if (u) {
            this.notification.success('Usuario registrado',
              `${u.nombreUsuario} fue creado exitosamente.`);
            this.loadAll();
          } else {
            this.notification.warning('Registro incompleto',
              'El backend no retornó el usuario creado. Revisa la lista.');
            this.loadAll();
          }
        },
        error: (err) => {
          // Logueo para diagnóstico — el error interceptor también notifica al usuario.
          console.error('[Usuarios] Error al registrar:', { payload, response: err?.error, status: err?.status });
          // Surface el error específico si el interceptor no lo cubrió bien.
          if (err?.status === 403) {
            this.notification.error('Sin permisos',
              'Solo usuarios con rol "Admin" pueden registrar nuevos usuarios.');
          } else if (err?.status === 400 && err?.error?.message) {
            this.notification.error('Validación', err.error.message);
          }
        }
      });
    });
  }

  /** Abre el modal de edición prellenando los datos actuales del usuario. */
  openEditForm(usuario: Usuario): void {
    if (!this.authService.hasPermission('usuarios:update')) return;
    if (!usuario.usuarioId) return;

    if (!this.rolField.options || this.rolField.options.length === 0) {
      this.notification.warning('Sin roles',
        'No hay roles disponibles para asignar.');
      return;
    }

    // Mapeo del rol "Nombre" → rolId para prellenar el select.
    const rolOption = this.rolField.options.find(
      o => (o.label ?? '').toLowerCase() === (usuario.rol ?? '').toLowerCase()
    );

    const initialValue = {
      nombreUsuario: usuario.nombreUsuario,
      email: usuario.email,
      rolId: rolOption?.value,
      activo: usuario.activo ?? true
    };

    const modalRef = this.modal.create({
      nzTitle: 'Editar Usuario',
      nzContent: FormModalComponent,
      nzData: { fields: this.fields, initialValue, mode: 'edit' },
      nzFooter: null,
      nzWidth: 640,
      nzCentered: true
    });

    modalRef.afterClose.subscribe((result) => {
      if (!result) return;

      const payload: ActualizarUsuario = {
        usuarioId: usuario.usuarioId!,
        nombreUsuario: (result.nombreUsuario ?? '').trim(),
        email: (result.email ?? '').trim(),
        rolId: result.rolId,
        activo: !!result.activo
      };

      this.usuarioService.actualizar(payload).subscribe({
        next: (u) => {
          this.notification.success('Usuario actualizado',
            `${u?.nombreUsuario ?? payload.nombreUsuario} fue actualizado correctamente.`);
          this.loadAll();
        },
        error: (err) => {
          if (err?.status === 403) {
            this.notification.error('Sin permisos',
              'Solo usuarios con rol "Admin" pueden actualizar usuarios.');
          } else if (err?.status === 400 && err?.error?.message) {
            this.notification.error('Validación', err.error.message);
          }
        }
      });
    });
  }

  /** Pide confirmación y realiza el soft-delete del usuario. */
  deleteUsuario(usuario: Usuario): void {
    if (!this.authService.hasPermission('usuarios:delete')) return;
    if (!usuario.usuarioId) return;

    this.modal.confirm({
      nzTitle: '¿Desactivar usuario?',
      nzContent: `El usuario "${usuario.nombreUsuario}" no podrá iniciar sesión hasta que sea reactivado.`,
      nzOkText: 'Desactivar',
      nzOkDanger: true,
      nzCancelText: 'Cancelar',
      nzOnOk: () => new Promise<void>((resolve) => {
        this.usuarioService.eliminar(usuario.usuarioId!).subscribe({
          next: () => {
            this.notification.success('Usuario desactivado',
              `${usuario.nombreUsuario} ha sido desactivado.`);
            this.loadAll();
            resolve();
          },
          error: (err) => {
            if (err?.status === 403) {
              this.notification.error('Sin permisos',
                'Solo usuarios con rol "Admin" pueden eliminar usuarios.');
            } else if (err?.error?.message) {
              this.notification.error('Error', err.error.message);
            }
            resolve();
          }
        });
      })
    });
  }
}
