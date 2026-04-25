import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const MENU_DEL_DIA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/menu-del-dia-page/menu-del-dia-page.component').then(m => m.MenuDelDiaPageComponent),
    canActivate: [authGuard]
  }
];
