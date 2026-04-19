import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const CLIENTES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/clientes-list/clientes-list.component').then(m => m.ClientesListComponent),
    canActivate: [authGuard]
  }
];

