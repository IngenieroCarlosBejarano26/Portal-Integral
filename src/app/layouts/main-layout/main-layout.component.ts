import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { AuthService } from '../../core/services/auth/authService';
import { ScreenInfoService } from '../../core/services/screen/screen-info.service';
import { RealtimeService } from '../../core/services/realtime/realtime.service';
import { RealtimeEvents } from '../../core/services/realtime/realtime-events';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { PlanService, PlanTenant } from '../../features/planes/services/plan.service';

interface MenuItem {
  label: string;
  icon?: any;
  path?: string;
  children?: MenuItem[];
  /** Código de permiso requerido para ver este ítem en el menú. */
  permission?: string;
  divider?: boolean;
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    NzLayoutModule,
    NzMenuModule,
    NzButtonModule,
    NzIconModule,
    NzAvatarModule,
    NzDropDownModule,
    NzBreadCrumbModule,
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private realtime = inject(RealtimeService);
  public screenInfoService = inject(ScreenInfoService);
  private destroy$ = new Subject<void>();
  private modal = inject(NzModalService);
  private notification = inject(NzNotificationService);
  private planService = inject(PlanService);

  isCollapsed = false;
  currentUser: any;
  menuItems: MenuItem[] = [];
  organizationName = '—';
  /** Plan + estado de vigencia del tenant. Alimenta el banner sticky. */
  plan: PlanTenant | null = null;

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadOrganizationName();
    this.initializeMenuItems();
    this.realtime.connect();
    this.subscribeToPermissionChanges();
    this.subscribeToOwnRolChange();
    this.subscribeToOwnDeactivation();
    this.subscribeToPlanChanges();
  }

  /**
   * Mantiene `this.plan` sincronizado con el plan + estado de vigencia. Se carga
   * al iniciar y se refresca cuando llegan eventos que pueden afectar la vigencia
   * (pago aprobado por el super admin, webhook Wompi confirmado, etc.).
   *
   * Es BEST-EFFORT: si el endpoint falla (ej: planes:view no autorizado por algun
   * rol limitado), simplemente no se muestra el banner.
   */
  private subscribeToPlanChanges(): void {
    this.planService.plan$
      .pipe(takeUntil(this.destroy$))
      .subscribe(p => this.plan = p);

    this.refreshPlan();

    const eventos = [
      RealtimeEvents.PagoManual.Approved,
      RealtimeEvents.PagoWompi.Approved
    ];
    eventos.forEach(ev => {
      this.realtime.on(ev)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => this.refreshPlan());
    });
  }

  private refreshPlan(): void {
    if (!this.authService.hasPermission('planes:view')) return;
    this.planService.obtenerMiPlan().subscribe({
      error: () => { /* best-effort: si el endpoint falla, no mostramos banner */ }
    });
  }

  /** True si debemos mostrar el banner sticky (estado EnGracia o Vencido). */
  get mostrarBannerVencimiento(): boolean {
    const estado = this.plan?.estadoPlan;
    return estado === 'EnGracia' || estado === 'Vencido';
  }

  /** Texto del banner segun estado y dias. */
  get textoBannerVencimiento(): string {
    if (!this.plan) return '';
    const dias = this.plan.diasVencido ?? 0;
    if (this.plan.estadoPlan === 'EnGracia') {
      const restanGracia = Math.max(0, (this.plan.diasGracia ?? 7) - dias);
      const hace = dias === 1 ? 'hace 1 dia' : `hace ${dias} dias`;
      const restan = restanGracia === 1 ? '1 dia' : `${restanGracia} dias`;
      return `Tu plan ${this.plan.planNombre} vencio ${hace}. Te quedan ${restan} de gracia para crear nuevos recursos. Renueva o cambia de plan para evitar bloqueos.`;
    }
    if (this.plan.estadoPlan === 'Vencido') {
      return `Tu plan ${this.plan.planNombre} esta vencido y la creacion de clientes, valeras y usuarios esta BLOQUEADA. Renueva o cambia de plan para continuar.`;
    }
    return '';
  }

  /** Color del banner segun severidad. */
  get colorBannerVencimiento(): 'warning' | 'danger' {
    return this.plan?.estadoPlan === 'Vencido' ? 'danger' : 'warning';
  }

  goToPlanes(): void { this.router.navigate(['/planes']); }

  /**
   * Si un admin desactiva/elimina al usuario actual, lo deslogeamos al instante
   * con un mensaje claro. Cualquier request posterior daría 401 anyway, mejor
   * cerrar la sesión con UX limpia.
   */
  private subscribeToOwnDeactivation(): void {
    this.realtime.on(RealtimeEvents.Usuario.Deactivated)
      .pipe(takeUntil(this.destroy$))
      .subscribe((payload: any) => {
        const myUsuarioId = this.authService.getCurrentUser()?.usuarioId;
        if (!myUsuarioId || payload?.usuarioId !== myUsuarioId) return;  // No soy yo

        this.notification.warning(
          'Sesión cerrada',
          'Tu cuenta fue desactivada por un administrador.',
          { nzDuration: 5000 }
        );
        // Pequeño delay para que el usuario alcance a leer el mensaje antes
        // de que la pantalla cambie a /login.
        setTimeout(() => this.authService.logout(), 1500);
      });
  }

  /**
   * Si un admin le cambia el rol al usuario actual (pasa de Cajero a Supervisor),
   * sus permisos efectivos cambian completamente. Solo este usuario debe refrescar.
   */
  private subscribeToOwnRolChange(): void {
    this.realtime.on(RealtimeEvents.Usuario.RolChanged)
      .pipe(takeUntil(this.destroy$))
      .subscribe((payload: any) => {
        const myUsuarioId = this.authService.getCurrentUser()?.usuarioId;
        if (!myUsuarioId || payload?.usuarioId !== myUsuarioId) return;  // No soy yo
        this.refreshAndReload('Tu rol fue actualizado. Aplicando nuevos permisos…');
      });
  }

  /**
   * Helper compartido: refresca el JWT, muestra notificación y fuerza re-render
   * de guards/componentes/menú. Lo usan ambos listeners (rol-changed y permissions-changed).
   */
  private refreshAndReload(message: string): void {
    this.authService.refreshToken().subscribe((ok) => {
      if (!ok) return;
      this.notification.info('Permisos actualizados', message, { nzDuration: 2500 });
      const url = this.router.url;
      this.router.navigateByUrl('/dashboard', { skipLocationChange: true })
        .then(() => this.router.navigateByUrl(url));
      this.initializeMenuItems();
    });
  }

  /**
   * Si un admin cambia los permisos de un rol, el backend emite el evento
   * `rol:permissions-changed`. Cualquier cliente del tenant lo recibe y refresca
   * su JWT para que los permisos efectivos se actualicen sin re-login.
   *
   * Tras el refresh recargamos la ruta actual para que menu / cards / guards
   * re-evaluen `hasPermission()` con los permisos nuevos.
   */
  private subscribeToPermissionChanges(): void {
    this.realtime.on(RealtimeEvents.Permiso.RolPermissionsChanged)
      .pipe(takeUntil(this.destroy$))
      .subscribe((payload: any) => {
        // Filtramos por rolId: solo refrescamos si el evento afecta al rol del
        // usuario actual. Si el JWT no tiene rolId (token viejo previo al deploy)
        // o el payload no trae rolId, refrescamos por defecto para no quedar
        // con permisos obsoletos.
        const myRolId = this.authService.getCurrentUser()?.rolId;
        const affectedRolId = payload?.rolId;
        if (myRolId && affectedRolId && myRolId !== affectedRolId) {
          return;  // No me afecta
        }

        this.refreshAndReload('Tus permisos fueron modificados. Aplicando cambios…');
      });
  }

  ngOnDestroy(): void {
    this.realtime.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  isActive(path?: string): boolean {
    if (!path) return false;
    return this.router.url.startsWith(path);
  }

  getUserInitial(): string {
    const name = this.currentUser?.nombreUsuario || '';
    return name.charAt(0).toUpperCase() || 'U';
  }

  private loadCurrentUser(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.applyOrganizationName(this.currentUser);
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.currentUser = user;
        this.applyOrganizationName(user);
      });
  }

  /**
   * Toma el nombre del tenant del usuario logueado (devuelto por el backend en el login).
   * Si por alguna razón no estuviera disponible, hace fallback al claim `tenantNombre` del JWT.
   */
  private applyOrganizationName(user: any): void {
    if (user?.tenant) {
      this.organizationName = user.tenant;
      return;
    }
    const token = this.authService.getToken();
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.organizationName =
        payload.tenantNombre || payload.tenant || this.organizationName;
    } catch {
      /* token mal formado: mantener fallback */
    }
  }

  private loadOrganizationName(): void {
    // Mantenido por compatibilidad: ya cubierto por applyOrganizationName().
    this.applyOrganizationName(this.currentUser);
  }

  private initializeMenuItems(): void {
    const all: MenuItem[] = [
      { label: 'Dashboard', icon: 'dashboard',     path: '/dashboard', permission: 'dashboard:view' },
      { label: 'Clientes',  icon: 'usergroup-add', path: '/clientes',  permission: 'clientes:view'  },
      { label: 'Empresas',  icon: 'shop',          path: '/empresas',  permission: 'empresas:view'  },
      { label: 'Usuarios',  icon: 'team',          path: '/usuarios',  permission: 'usuarios:view'  },
      { label: 'Roles',     icon: 'safety',        path: '/roles',     permission: 'roles:view'     },
      { label: 'Tenants',   icon: 'bank',          path: '/tenants',   permission: 'tenants:view'   },
      { label: 'Valeras',   icon: 'gift',          path: '/valeras',   permission: 'valeras:view'   },
      { label: 'Consumos',  icon: 'bar-chart',     path: '/consumos',  permission: 'consumos:view'  },
      { label: 'Permisos',  icon: 'safety-certificate', path: '/permisos', permission: 'permisos:view' },
      { label: 'Conf. Correo', icon: 'mail', path: '/configuracion-email', permission: 'configuracion-email:view' },
      { label: 'Mi Plan',   icon: 'crown',         path: '/planes',    permission: 'planes:view' },
      { label: 'Pagos en línea', icon: 'thunderbolt', path: '/pagos-wompi', permission: 'pagos-manuales:create' },
      { label: 'Pagos pendientes', icon: 'dollar', path: '/pagos-manuales/pendientes', permission: 'pagos-manuales:approve' }
    ];

    // Si no hay permiso definido o el usuario lo tiene, se muestra.
    // Admin tiene acceso total → vé todo (gestión por hasPermission del AuthService).
    this.menuItems = all.filter(
      item => !item.permission || this.authService.hasPermission(item.permission)
    );
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  logout(): void {
    this.modal.confirm({
      nzTitle: '¿Cerrar sesión?',
      nzContent: 'Tendrás que volver a iniciar sesión para acceder al portal.',
      nzOkText: 'Cerrar sesión',
      nzOkDanger: true,
      nzCancelText: 'Cancelar',
      nzOnOk: () => this.authService.logout(),
    });
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }
}
