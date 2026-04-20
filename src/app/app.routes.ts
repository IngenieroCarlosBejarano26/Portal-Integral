import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/pages/login/login.component').then(m => m.LoginComponent)
  },

  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', loadChildren: () => import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES)},
      { path: 'clientes', loadChildren: () => import('./features/clientes/clientes.routes').then((m) => m.CLIENTES_ROUTES)},
      { path: 'empresas', loadChildren: () => import('./features/empresas/empresas.routes').then((m) => m.EMPRESAS_ROUTES)},
      { path: 'roles', loadChildren: () => import('./features/roles/roles.routes').then((m) => m.ROLES_ROUTES)},
      { path: 'tenants', loadChildren: () => import('./features/tenants/tenants.routes').then((m) => m.TENANTS_ROUTES)},
      { path: 'usuarios', loadChildren: () => import('./features/usuarios/usuarios.routes').then((m) => m.USUARIOS_ROUTES)},
      { path: 'valeras', loadChildren: () => import('./features/valeras/valeras.routes').then((m) => m.VALERAS_ROUTES)},
      { path: 'consumos', loadChildren: () => import('./features/consumos/consumos.routes').then((m) => m.CONSUMOS_ROUTES)},
      { path: 'permisos', loadChildren: () => import('./features/permisos/permisos.routes').then((m) => m.PERMISOS_ROUTES)},
      { path: 'configuracion-email', loadChildren: () => import('./features/configuracion-email/configuracion-email.routes').then((m) => m.CONFIGURACION_EMAIL_ROUTES)},
      { path: 'perfil', loadChildren: () => import('./features/perfil/perfil.routes').then((m) => m.PERFIL_ROUTES)},      
    ]
  },

  { path: '**', redirectTo: 'login' }
];
