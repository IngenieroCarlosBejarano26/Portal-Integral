import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const CONSUMOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/consumos-list/consumos-list.component').then(m => m.ConsumusListComponent),
    canActivate: [authGuard]
  }
];


