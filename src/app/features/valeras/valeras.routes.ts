import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const VALERAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/valeras-list/valeras-list.component').then(m => m.ValerasListComponent),
    canActivate: [authGuard]
  }
];


