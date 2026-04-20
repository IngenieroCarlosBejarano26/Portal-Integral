import { Routes } from '@angular/router';

export const PERMISOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/permisos-list/permisos-list.component')
      .then(m => m.PermisosListComponent)
  }
];
