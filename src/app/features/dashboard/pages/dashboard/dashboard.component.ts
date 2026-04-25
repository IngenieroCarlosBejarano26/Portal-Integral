import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
import { PlanUsageWidgetComponent } from '../../../planes/components/plan-usage-widget/plan-usage-widget.component';

interface ModuleStat {
  /** Identificador interno usado para mapear eventos realtime. */
  id: 'clientes' | 'empresas' | 'consumos' | 'valeras' | 'roles' | 'tenants' | 'usuarios';
  label: string;
  value: number;
  icon: string;
  color: string;
  path: string;
  /** Permiso requerido para ver la card. Si no se tiene, la card se oculta. */
  permission: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NzIconModule, NzButtonModule, PlanUsageWidgetComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
private authService = inject(AuthService);
private router = inject(Router);
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
    { id: 'clientes', label: 'Clientes', value: 0, icon: 'usergroup-add', color: '#5B5BD6', path: '/clientes', permission: 'clientes:view' },
    { id: 'empresas', label: 'Empresas', value: 0, icon: 'shop',          color: '#0ea5e9', path: '/empresas', permission: 'empresas:view' },
    { id: 'consumos', label: 'Usos', value: 0, icon: 'bar-chart',     color: '#10b981', path: '/consumos', permission: 'consumos:view' },
    { id: 'valeras',  label: 'Valeras',  value: 0, icon: 'gift',          color: '#f59e0b', path: '/valeras',  permission: 'valeras:view' },
    { id: 'roles',    label: 'Roles',    value: 0, icon: 'safety',        color: '#ec4899', path: '/roles',    permission: 'roles:view' },
    { id: 'tenants',  label: 'Tenants',  value: 0, icon: 'bank',          color: '#8b5cf6', path: '/tenants',  permission: 'tenants:view' },
    { id: 'usuarios', label: 'Usuarios', value: 0, icon: 'team',          color: '#14b8a6', path: '/usuarios', permission: 'usuarios:view' }
  ];

  /** Cards filtradas por permiso del usuario — oculta las que no puede ver. */
  get visibleModules(): ModuleStat[] {
    return this.modules.filter(m => this.authService.hasPermission(m.permission));
  }

  /** Saludo según la hora del día. */
  get greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  /** Fecha actual formateada para el hero del dashboard. */
  get todayFormatted(): string {
    return new Date().toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  goToModule(path: string): void {
    this.router.navigate([path]);
  }

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
    // Solo cargamos contadores de los módulos que el usuario puede ver —
    // evita disparar requests que el backend rechazará con 403.
    const visibleIds = new Set(this.visibleModules.map(m => m.id));
    const safeCount = (id: ModuleStat['id']) =>
      visibleIds.has(id) ? this.getModuleCountSource(id).pipe(catchError(() => of(0))) : of(0);

    forkJoin({
      clientes: safeCount('clientes'),
      empresas: safeCount('empresas'),
      consumos: safeCount('consumos'),
      valeras:  safeCount('valeras'),
      roles:    safeCount('roles'),
      tenants:  safeCount('tenants'),
      usuarios: safeCount('usuarios')
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
