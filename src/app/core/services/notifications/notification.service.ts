import { Injectable } from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';

/**
 * Wrapper sobre NzNotificationService que expone shortcuts tipados
 * (`success`, `warning`, `error`, `info`) y mantiene la API genérica
 * `createNotification` por compatibilidad con código existente.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  constructor(private notification: NzNotificationService) {}

  createNotification(type: string, title: string, message: string): void {
    this.notification.create(type, title, message);
  }

  success(title: string, message: string = ''): void {
    this.notification.success(title, message);
  }

  warning(title: string, message: string = ''): void {
    this.notification.warning(title, message);
  }

  error(title: string, message: string = ''): void {
    this.notification.error(title, message);
  }

  info(title: string, message: string = ''): void {
    this.notification.info(title, message);
  }
}
