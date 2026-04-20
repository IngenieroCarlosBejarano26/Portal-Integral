import { Directive, Input, TemplateRef, ViewContainerRef, inject, OnInit } from '@angular/core';
import { AuthService } from '../../core/services/auth/authService';

/**
 * Directiva estructural que renderiza el elemento solo si el usuario
 * actual tiene el permiso indicado. Acepta un código o un array.
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
export class HasPermissionDirective implements OnInit {
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private authService = inject(AuthService);

  @Input('appHasPermission') permission!: string | string[];

  ngOnInit(): void {
    if (this.authService.hasPermission(this.permission)) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    } else {
      this.viewContainer.clear();
    }
  }
}
