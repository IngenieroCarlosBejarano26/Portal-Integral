import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { forkJoin, Observable, of, Subject } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth/authService';
import { ClienteService } from '../../../clientes/services/cliente.service';
import { EmpresaService } from '../../../empresas/services/empresa.service';
import { ConsumoService } from '../../../consumos/services/consumo.service';
import { ValeraService } from '../../../valeras/services/valera.service';
import { RolService } from '../../../roles/services/rol.service';
import { TenantService } from '../../../tenants/services/tenant.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { RealtimeEvents, RealtimeEventName } from '../../../../core/services/realtime/realtime-events';

interface ModuleStat {
  /** Identificador interno usado para mapear eventos realtime. */
  id: 'clientes' | 'empresas' | 'consumos' | 'valeras' | 'roles' | 'tenants' | 'usuarios';
  label: string;
  value: number;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NzIconModule, NzButtonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
private authService = inject(AuthService);
private clienteService = inject(ClienteService);
private empresaService = inject(EmpresaService);
private consumoService = inject(ConsumoService);
private valeraService = inject(ValeraService);
private rolService = inject(RolService);
private tenantService = inject(TenantService);
private realtime = inject(RealtimeService);
private destroy$ = new Subject<void>();

  currentUser: any;
  tenantName = '—';
  tenantId = '—';
  rolNombre = '—';
  lastSync = '—';
  totalUsuarios = 0;
  loading = false;

  modules: ModuleStat[] = [
    { id: 'clientes', label: 'Clientes', value: 0, icon: 'usergroup-add', color: '#6366f1' },
    { id: 'empresas', label: 'Empresas', value: 0, icon: 'shop', color: '#0ea5e9' },
    { id: 'consumos', label: 'Consumos', value: 0, icon: 'bar-chart', color: '#10b981' },
    { id: 'valeras', label: 'Valeras', value: 0, icon: 'gift', color: '#f59e0b' },
    { id: 'roles', label: 'Roles', value: 0, icon: 'safety', color: '#ec4899' },
    { id: 'tenants', label: 'Tenants', value: 0, icon: 'bank', color: '#8b5cf6' },
    { id: 'usuarios', label: 'Usuarios', value: 0, icon: 'user', color: '#14b8a6' }
  ];

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.parseTokenInfo();
    this.loadStats();
    this.subscribeToRealtimeEvents();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private subscribeToRealtimeEvents(): void {
    // Mapeo evento → módulo afectado. Cada evento refresca SOLO ese contador (1 request HTTP),
    // en lugar de recargar las 7 listas con forkJoin.
    const eventToModule: Array<{ event: RealtimeEventName; moduleId: ModuleStat['id'] }> = [
      { event: RealtimeEvents.Cliente.Created, moduleId: 'clientes' },
      { event: RealtimeEvents.Cliente.Updated, moduleId: 'clientes' },
      { event: RealtimeEvents.Cliente.Deleted, moduleId: 'clientes' },

      { event: RealtimeEvents.Empresa.Created, moduleId: 'empresas' },
      { event: RealtimeEvents.Empresa.Updated, moduleId: 'empresas' },
      { event: RealtimeEvents.Empresa.Deleted, moduleId: 'empresas' },

      { event: RealtimeEvents.Consumo.Created, moduleId: 'consumos' },
      { event: RealtimeEvents.Consumo.Updated, moduleId: 'consumos' },
      { event: RealtimeEvents.Consumo.Deleted, moduleId: 'consumos' },

      { event: RealtimeEvents.Valera.Created, moduleId: 'valeras' },
      { event: RealtimeEvents.Valera.Updated, moduleId: 'valeras' },
      { event: RealtimeEvents.Valera.Deleted, moduleId: 'valeras' },

      { event: RealtimeEvents.Rol.Created, moduleId: 'roles' },
      { event: RealtimeEvents.Rol.Updated, moduleId: 'roles' },
      { event: RealtimeEvents.Rol.Deleted, moduleId: 'roles' },

      { event: RealtimeEvents.Tenant.Created, moduleId: 'tenants' },
      { event: RealtimeEvents.Tenant.Updated, moduleId: 'tenants' },
      { event: RealtimeEvents.Tenant.Deleted, moduleId: 'tenants' },

      { event: RealtimeEvents.Usuario.Created, moduleId: 'usuarios' },
      { event: RealtimeEvents.Usuario.Updated, moduleId: 'usuarios' }
    ];

    for (const { event, moduleId } of eventToModule) {
      this.realtime.on(event)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => this.refreshModule(moduleId));
    }
  }

  private parseTokenInfo(): void {
    const token = this.authService.getToken();
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.tenantId = payload.tenantId || payload.tid || '—';
      this.tenantName = payload.tenantNombre || payload.tenant || '—';
      this.rolNombre =
        payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
        payload.role || payload.rol || '—';

      // Sincronizar info en currentUser por si el login no la guardó
      if (!this.currentUser) this.currentUser = {};
      this.currentUser.nombreUsuario =
        this.currentUser.nombreUsuario || payload.unique_name || payload.name;
      this.currentUser.email = this.currentUser.email || payload.email;
      this.currentUser.usuarioId = this.currentUser.usuarioId || payload.sub;
    } catch { /* ignore */ }
  }

  /** Devuelve el endpoint COUNT (escalar) de cada módulo. */
  private getModuleCountSource(moduleId: ModuleStat['id']): Observable<number> {
    switch (moduleId) {
      case 'clientes': return this.clienteService.getCount();
      case 'empresas': return this.empresaService.getCount();
      case 'consumos': return this.consumoService.getCount();
      case 'valeras':  return this.valeraService.getCount();
      case 'roles':    return this.rolService.getCount();
      case 'tenants':  return this.tenantService.getCount();
      case 'usuarios': return this.authService.getUsuariosCountByTenant();
    }
  }

  /** Refresca el contador de UN solo módulo via endpoint COUNT (1 request liviano). */
  private refreshModule(moduleId: ModuleStat['id']): void {
    const module = this.modules.find(m => m.id === moduleId);
    if (!module) return;

    this.getModuleCountSource(moduleId)
      .pipe(catchError(() => of(0)), takeUntil(this.destroy$))
      .subscribe((total) => {
        module.value = total;
        if (moduleId === 'usuarios') this.totalUsuarios = total;
        this.touchLastSync();
      });
  }

  private touchLastSync(): void {
    this.lastSync = new Date().toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
  }

  loadStats(): void {
    this.loading = true;
    forkJoin({
      clientes: this.clienteService.getCount().pipe(catchError(() => of(0))),
      empresas: this.empresaService.getCount().pipe(catchError(() => of(0))),
      consumos: this.consumoService.getCount().pipe(catchError(() => of(0))),
      valeras: this.valeraService.getCount().pipe(catchError(() => of(0))),
      roles: this.rolService.getCount().pipe(catchError(() => of(0))),
      tenants: this.tenantService.getCount().pipe(catchError(() => of(0))),
      usuarios: this.authService.getUsuariosCountByTenant().pipe(catchError(() => of(0)))
    }).subscribe({
      next: (data) => {
        this.setModuleValue('clientes', data.clientes);
        this.setModuleValue('empresas', data.empresas);
        this.setModuleValue('consumos', data.consumos);
        this.setModuleValue('valeras', data.valeras);
        this.setModuleValue('roles', data.roles);
        this.setModuleValue('tenants', data.tenants);
        this.setModuleValue('usuarios', data.usuarios);
        this.totalUsuarios = data.usuarios;
        this.touchLastSync();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  private setModuleValue(moduleId: ModuleStat['id'], value: number): void {
    const module = this.modules.find(m => m.id === moduleId);
    if (module) module.value = value;
  }

  onRefresh(): void {
    this.loadStats();
  }
}
