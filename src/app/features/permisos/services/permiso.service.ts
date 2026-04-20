import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment.local';

export interface Permiso {
  permisoId: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  modulo: string;
  accion: string;
}

interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

@Injectable({ providedIn: 'root' })
export class PermisoService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.api!.baseUrl}/api/Permiso`;

  /** Catálogo completo de permisos disponibles. */
  getAll(): Observable<Permiso[]> {
    return this.http.get<ApiResponse<Permiso[]>>(this.baseUrl).pipe(
      map(res => res?.data ?? []),
      catchError(() => of([]))
    );
  }

  /** Permisos asignados a un rol. */
  getByRol(rolId: string): Observable<Permiso[]> {
    return this.http.get<ApiResponse<Permiso[]>>(`${this.baseUrl}/rol/${rolId}`).pipe(
      map(res => res?.data ?? []),
      catchError(() => of([]))
    );
  }

  /** Reemplaza la asignación de permisos de un rol. */
  assignToRol(rolId: string, permisoIds: string[]): Observable<boolean> {
    return this.http.post<ApiResponse<boolean>>(`${this.baseUrl}/rol/${rolId}`, permisoIds).pipe(
      map(res => res?.data ?? false)
    );
  }
}
