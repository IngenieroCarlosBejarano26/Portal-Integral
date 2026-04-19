import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const TENANTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/tenants-list/tenants-list.component').then(m => m.TenantsListComponent),
    canActivate: [authGuard]
  }
];


