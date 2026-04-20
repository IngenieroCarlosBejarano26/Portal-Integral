import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const CONFIGURACION_EMAIL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/configuracion-email-page/configuracion-email-page.component')
        .then(m => m.ConfiguracionEmailPageComponent),
    canActivate: [authGuard]
  }
];

