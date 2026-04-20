import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notifications/notification.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notification = inject(NotificationService);

  return next(req).pipe(
    catchError((error) => {
      const status = error?.status;
      const backendMessage = error?.error?.message;

      // 409 Conflict: regla de negocio que el caller SIEMPRE maneja localmente
      // (p. ej. valera vencida, sin almuerzos). No mostramos notificación global
      // para evitar duplicados con el manejo específico de cada componente.
      if (status === 409) {
        return throwError(() => error);
      }

      let userMessage = 'Ha ocurrido un error inesperado.';

      switch (status) {
        case 0:
          userMessage = 'No se pudo conectar con el servidor.';
          break;
        case 400:
          userMessage = backendMessage || 'La solicitud no es válida.';
          break;
        case 401:
          userMessage = 'No estás autorizado. Por favor, inicia sesión.';
          break;
        case 403:
          userMessage = 'No tienes permisos para realizar esta acción.';
          break;
        case 404:
          userMessage = 'El recurso solicitado no fue encontrado.';
          break;
        case 500:
          userMessage = 'Error interno del servidor. Intenta más tarde.';
          break;
        default:
          if (backendMessage) {
            userMessage = backendMessage;
          }
          break;
      }

      notification.createNotification(
        'error',
        `Error ${status || ''}`.trim(),
        userMessage
      );

      return throwError(() => error);
    })
  );
};
