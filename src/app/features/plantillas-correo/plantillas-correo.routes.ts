import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const PLANTILLAS_CORREO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/plantillas-correo-page/plantillas-correo-page.component').then(
        m => m.PlantillasCorreoPageComponent
      ),
    canActivate: [authGuard]
  }
];
