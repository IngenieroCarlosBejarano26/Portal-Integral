import { Routes } from '@angular/router';

export const PAGOS_WOMPI_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/pagos-wompi-page/pagos-wompi-page.component')
        .then(m => m.PagosWompiPageComponent)
  }
];
