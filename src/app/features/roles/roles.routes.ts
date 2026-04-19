import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const ROLES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/roles-list/roles-list.component').then(m => m.RolesListComponent),
    canActivate: [authGuard]
  }
];


