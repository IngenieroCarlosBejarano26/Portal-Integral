import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/pages/login/login.component').then(m => m.LoginComponent)
  },

  // Escaneo de QR — ruta corta y standalone (sin MainLayout) para que en móvil
  // se vea como una pantalla foco. authGuard internamente preserva returnUrl.
  {
    path: 'v',
    loadChildren: () => import('./features/qr-scan/qr-scan.routes').then(m => m.QR_SCAN_ROUTES)
  },

  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', canActivate: [permissionGuard], data: { permission: 'dashboard:view' },
        loadChildren: () => import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES) },
      { path: 'clientes', canActivate: [permissionGuard], data: { permission: 'clientes:view' },
        loadChildren: () => import('./features/clientes/clientes.routes').then((m) => m.CLIENTES_ROUTES) },
      { path: 'empresas', canActivate: [permissionGuard], data: { permission: 'empresas:view' },
        loadChildren: () => import('./features/empresas/empresas.routes').then((m) => m.EMPRESAS_ROUTES) },
      { path: 'roles', canActivate: [permissionGuard], data: { permission: 'roles:view' },
        loadChildren: () => import('./features/roles/roles.routes').then((m) => m.ROLES_ROUTES) },
      { path: 'tenants', canActivate: [permissionGuard], data: { permission: 'tenants:view' },
        loadChildren: () => import('./features/tenants/tenants.routes').then((m) => m.TENANTS_ROUTES) },
      { path: 'usuarios', canActivate: [permissionGuard], data: { permission: 'usuarios:view' },
        loadChildren: () => import('./features/usuarios/usuarios.routes').then((m) => m.USUARIOS_ROUTES) },
      { path: 'valeras', canActivate: [permissionGuard], data: { permission: 'valeras:view' },
        loadChildren: () => import('./features/valeras/valeras.routes').then((m) => m.VALERAS_ROUTES) },
      { path: 'consumos', canActivate: [permissionGuard], data: { permission: 'consumos:view' },
        loadChildren: () => import('./features/consumos/consumos.routes').then((m) => m.CONSUMOS_ROUTES) },
      { path: 'permisos', canActivate: [permissionGuard], data: { permission: 'permisos:view' },
        loadChildren: () => import('./features/permisos/permisos.routes').then((m) => m.PERMISOS_ROUTES) },
      { path: 'configuracion-email', canActivate: [permissionGuard], data: { permission: 'configuracion-email:view' },
        loadChildren: () => import('./features/configuracion-email/configuracion-email.routes').then((m) => m.CONFIGURACION_EMAIL_ROUTES) },
      { path: 'perfil', loadChildren: () => import('./features/perfil/perfil.routes').then((m) => m.PERFIL_ROUTES) },
    ]
  },

  { path: '**', redirectTo: 'login' }
];
