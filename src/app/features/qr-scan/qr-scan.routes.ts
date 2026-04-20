import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

/**
 * Ruta pública del escaneo de QR.
 * Path: /v/:codigo
 *
 * NOTA: usamos `authGuard` (no `permissionGuard`) porque queremos que CUALQUIER
 * usuario logueado vea la valera. La acción de consumir está gateada dentro
 * del componente con `valeras:execute`.
 */
export const QR_SCAN_ROUTES: Routes = [
  {
    path: ':codigo',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/qr-scan-page/qr-scan-page.component')
        .then(m => m.QrScanPageComponent)
  }
];
