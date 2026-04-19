import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
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
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface MenuItem {
  label: string;
  icon?: any;
  path?: string;
  children?: MenuItem[];
  divider?: boolean;
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    NzLayoutModule,
    NzMenuModule,
    NzButtonModule,
    NzIconModule,
    NzAvatarModule,
    NzDropDownModule,
    NzBreadCrumbModule
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css'
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private realtime = inject(RealtimeService);
  public screenInfoService = inject(ScreenInfoService);
  private destroy$ = new Subject<void>();

  isCollapsed = false;
  currentUser: any;
  menuItems: MenuItem[] = [];
  organizationName = '—';

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadOrganizationName();
    this.initializeMenuItems();
    this.realtime.connect();
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
      .subscribe(user => {
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
      this.organizationName = payload.tenantNombre || payload.tenant || this.organizationName;
    } catch { /* token mal formado: mantener fallback */ }
  }

  private loadOrganizationName(): void {
    // Mantenido por compatibilidad: ya cubierto por applyOrganizationName().
    this.applyOrganizationName(this.currentUser);
  }

  private initializeMenuItems(): void {
    this.menuItems = [
      { label: 'Dashboard', icon: 'dashboard', path: '/dashboard' },
      { label: 'Clientes', icon: 'usergroup-add', path: '/clientes' },
      { label: 'Empresas', icon: 'shop', path: '/empresas' },
      { label: 'Roles', icon: 'safety', path: '/roles' },
      { label: 'Tenants', icon: 'bank', path: '/tenants' },
      { label: 'Valeras', icon: 'gift', path: '/valeras' },
      { label: 'Consumos', icon: 'bar-chart', path: '/consumos' },
      { label: 'Perfil', icon: 'user', path: '/perfil' }
    ];
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  logout(): void {
    this.authService.logout();
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }
}
