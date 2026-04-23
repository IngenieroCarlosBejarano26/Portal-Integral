import { Routes } from '@angular/router';

export const PAGOS_MANUALES_ROUTES: Routes = [
  {
    path: 'pendientes',
    loadComponent: () =>
      import('./pages/pagos-pendientes-page/pagos-pendientes-page.component')
        .then(m => m.PagosPendientesPageComponent)
  }
];
