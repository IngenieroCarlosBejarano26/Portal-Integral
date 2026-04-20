import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const USUARIOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/usuarios-list/usuarios-list.component').then(m => m.UsuariosListComponent),
    canActivate: [authGuard]
  }
];
