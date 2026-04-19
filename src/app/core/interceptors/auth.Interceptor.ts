import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth/authService';
import { environment } from '../../../environments/environment.local';

/**
 * Genera un GUID v4 robusto (con fallback si crypto.randomUUID no está disponible).
 */
function generateGuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback RFC 4122 v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Endpoints que NO requieren idempotencia (deben coincidir con la API).
 */
const IDEMPOTENCY_EXCLUDED_PATHS = ['/auth/login', '/auth/registrar'];

/**
 * Métodos HTTP que requieren X-Idempotency-Key (deben coincidir con IdempotencyMiddleware).
 */
const IDEMPOTENT_METHODS = ['POST', 'PUT'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();
  const apiKey = environment.api?.apiKey || '';

  const isPublic = req.url.includes('/public/');
  const method = req.method.toUpperCase();
  const urlLower = req.url.toLowerCase();

  // Headers base
  const headers: { [key: string]: string } = {
    'X-Api-Key': apiKey
  };

  // Authorization (Bearer JWT)
  if (token && !isPublic) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Idempotency Key (POST/PUT excepto endpoints excluidos)
  const requiresIdempotency =
    IDEMPOTENT_METHODS.includes(method) &&
    !IDEMPOTENCY_EXCLUDED_PATHS.some((p) => urlLower.includes(p));

  if (requiresIdempotency && !req.headers.has('X-Idempotency-Key')) {
    headers['X-Idempotency-Key'] = generateGuid();
  }

  const authReq = req.clone({ setHeaders: headers });
  return next(authReq);
};
