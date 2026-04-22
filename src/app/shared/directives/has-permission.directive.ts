import { Directive, Input, TemplateRef, ViewContainerRef, inject, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth/authService';

/**
 * Directiva estructural que renderiza el elemento solo si el usuario
 * actual tiene el permiso indicado. Acepta un código o un array.
 *
 * Es REACTIVA: se re-evalua automaticamente cuando cambia el usuario
 * (login, logout, refreshToken al cambiar permisos del rol). Asi los
 * botones se ocultan/muestran sin necesidad de recargar la pagina.
 *
 * Uso:
 * ```html
 * <button *appHasPermission="'usuarios:delete'">Eliminar</button>
 * <button *appHasPermission="['usuarios:update','usuarios:delete']">...</button>
 * ```
 */
@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective implements OnInit, OnDestroy {
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private authService = inject(AuthService);
  private subscription?: Subscription;
  private isRendered = false;

  @Input('appHasPermission') permission!: string | string[];

  ngOnInit(): void {
    // Re-evaluar cada vez que cambia el usuario (incluye refreshToken
    // tras evento rol:permissions-changed por SignalR).
    this.subscription = this.authService.currentUser$.subscribe(() => {
      this.updateView();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private updateView(): void {
    const allowed = this.authService.hasPermission(this.permission);

    if (allowed && !this.isRendered) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.isRendered = true;
    } else if (!allowed && this.isRendered) {
      this.viewContainer.clear();
      this.isRendered = false;
    }
  }
}

