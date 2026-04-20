import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment.local';

export interface Usuario {
  usuarioId?: string;
  nombreUsuario?: string;
  email?: string;
  rol?: string;
  tenant?: string;
  activo?: boolean;
  fechaCreacion?: string;
}

export interface RegistrarUsuario {
  nombreUsuario: string;
  password: string;
  confirmarPassword: string;
  email: string;
  rolId: string;
  tenantId: string;
}

export interface ActualizarUsuario {
  usuarioId: string;
  nombreUsuario: string;
  email: string;
  rolId: string;
  activo: boolean;
}

interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

/**
 * Servicio para gestión de usuarios.
 * Los endpoints viven en /api/Auth porque la creación de usuarios está
 * acoplada al flujo de autenticación (hashing de password, validación de tenant).
 */
@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.api!.baseUrl}/api/Auth`;

  private usuariosSubject = new BehaviorSubject<Usuario[]>([]);
  public usuarios$ = this.usuariosSubject.asObservable();

  /** Obtiene los usuarios del tenant indicado (extraído del JWT por el caller). */
  getUsuariosByTenant(tenantId: string): Observable<Usuario[]> {
    return this.http.get<ApiResponse<Usuario[]>>(`${this.baseUrl}/usuarios/${tenantId}`).pipe(
      map(res => res?.data ?? []),
      tap(list => this.usuariosSubject.next(list)),
      catchError(() => of([]))
    );
  }

  /** Registra un nuevo usuario para el tenant. */
  registrar(payload: RegistrarUsuario): Observable<Usuario | null> {
    return this.http.post<ApiResponse<Usuario>>(`${this.baseUrl}/registrar`, payload).pipe(
      tap(res => {
        if (res?.success === false) {
          // El backend retorna 200 con success=false para errores de negocio
          throw new Error(res.message ?? 'No se pudo registrar el usuario');
        }
      }),
      map(res => res?.data ?? null),
      tap(u => {
        if (u) this.usuariosSubject.next([...this.usuariosSubject.value, u]);
      })
    );
  }

  /** Actualiza datos editables del usuario (sólo Admin). */
  actualizar(payload: ActualizarUsuario): Observable<Usuario | null> {
    return this.http.put<ApiResponse<Usuario>>(`${this.baseUrl}/usuarios`, payload).pipe(
      map(res => res?.data ?? null),
      tap(updated => {
        if (!updated) return;
        const list = this.usuariosSubject.value.map(u =>
          u.usuarioId === updated.usuarioId ? { ...u, ...updated } : u);
        this.usuariosSubject.next(list);
      })
    );
  }

  /** Soft-delete: marca al usuario como inactivo (sólo Admin). */
  eliminar(usuarioId: string): Observable<boolean> {
    return this.http.delete<ApiResponse<boolean>>(`${this.baseUrl}/usuarios/${usuarioId}`).pipe(
      map(res => res?.data ?? false),
      tap(ok => {
        if (!ok) return;
        const list = this.usuariosSubject.value.map(u =>
          u.usuarioId === usuarioId ? { ...u, activo: false } : u);
        this.usuariosSubject.next(list);
      })
    );
  }
}
