import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { AuthService } from '../services/auth/authService';

/**
 * Guard de autorización por permiso. Lee `route.data.permission`
 * (string o string[]) y valida contra los permisos del JWT.
 *
 * Si NO tiene el permiso → redirige a `/dashboard` y muestra notificación.
 * (Se asume que `dashboard:view` lo tiene cualquier usuario logueado;
 *  si tampoco lo tuviera, redirige al login.)
 *
 * Uso en routes:
 * ```ts
 * { path: 'tenants',
 *   canActivate: [authGuard, permissionGuard],
 *   data: { permission: 'tenants:view' },
 *   loadChildren: ... }
 * ```
 */
export const permissionGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const notification = inject(NzNotificationService);

  const required = route.data?.['permission'] as string | string[] | undefined;
  if (!required) return true; // sin permiso declarado = público

  if (authService.hasPermission(required)) return true;

  notification.warning(
    'Acceso restringido',
    'No tienes permiso para acceder a este módulo.',
    { nzDuration: 4000 }
  );

  // Redirigir a dashboard si lo tiene; si no, al login.
  const target = authService.hasPermission('dashboard:view') ? '/dashboard' : '/login';
  router.navigate([target]);
  return false;
};
