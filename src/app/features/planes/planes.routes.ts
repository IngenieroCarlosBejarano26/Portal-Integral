import { Routes } from '@angular/router';

export const PLANES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/planes-page/planes-page.component').then(m => m.PlanesPageComponent)
  }
];
