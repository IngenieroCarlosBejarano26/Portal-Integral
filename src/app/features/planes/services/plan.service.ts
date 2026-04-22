import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../../../core/services/base-api.service';
import { environment } from '../../../../environments/environment.local';

/**
 * Plan asignado al tenant + uso actual de cada recurso.
 * Coincide con Application.Features.Planes.DTOs.PlanTenantDto.
 */
export interface PlanTenant {
  planId: string;
  planNombre: string;
  planDescripcion?: string;

  // Limites del plan (NULL = ilimitado)
  maxClientes?: number | null;
  maxValeras?: number | null;
  maxUsuarios?: number | null;

  // Uso actual del tenant
  clientesActuales: number;
  valerasActuales: number;
  usuariosActuales: number;

  precioMensualUSD: number;
  fechaInicioPlan?: string | null;
  fechaFinPlan?: string | null;

  // % de uso (calculado en backend, null si limite es null = ilimitado)
  porcentajeClientes?: number | null;
  porcentajeValeras?: number | null;
  porcentajeUsuarios?: number | null;
}

/**
 * Plan disponible (catalogo). Se usa en la pantalla "Cambiar plan".
 */
export interface PlanCatalogo {
  planId: string;
  nombre: string;
  descripcion?: string;
  maxClientes?: number | null;
  maxValeras?: number | null;
  maxUsuarios?: number | null;
  precioMensualUSD: number;
}

@Injectable({ providedIn: 'root' })
export class PlanService {
  private http = inject(HttpClient);
  private base = environment.api!.baseUrl + '/api/planes';

  /** Devuelve plan + uso actual del tenant logueado. */
  obtenerMiPlan(): Observable<PlanTenant | null> {
    return this.http.get<ApiResponse<PlanTenant>>(this.base + '/mi-plan').pipe(
      map(r => r?.data ?? null)
    );
  }

  /** Lista los planes activos del catalogo (Basico, Pro, Premium). */
  listarPlanes(): Observable<PlanCatalogo[]> {
    return this.http.get<ApiResponse<PlanCatalogo[]>>(this.base).pipe(
      map(r => r?.data ?? [])
    );
  }

  /** Cambia el plan del tenant actual al plan indicado. */
  cambiarPlan(nuevoPlanId: string): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.base}/cambiar/${nuevoPlanId}`, {});
  }
}
