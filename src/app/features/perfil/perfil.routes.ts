import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const PERFIL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/perfil/perfil.component').then(m => m.PerfilComponent),
    canActivate: [authGuard]
  }
];

