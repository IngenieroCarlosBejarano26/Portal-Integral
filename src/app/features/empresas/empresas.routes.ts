import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const EMPRESAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/empresas-list/empresas-list.component').then(m => m.EmpresasListComponent),
    canActivate: [authGuard]
  }
];

