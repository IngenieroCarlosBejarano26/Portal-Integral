import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/authService';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated() && authService.hasValidToken()) {
    return true;
  }

  // Clear invalid token
  localStorage.removeItem('auth_token');
  localStorage.removeItem('current_user');

  // Conservamos la URL solicitada para redirigir tras el login.
  // Útil para deep-links como /v/:codigo (escaneo de QR).
  router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
  return false;
};

