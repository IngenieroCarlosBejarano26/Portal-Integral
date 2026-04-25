import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
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
  /** Dias de duracion del plan (catalogo). */
  duracionDias?: number;
  fechaInicioPlan?: string | null;
  fechaFinPlan?: string | null;

  /** True si el tenant esta en periodo de trial gratuito. */
  esTrial?: boolean;
  /** Dias restantes del trial (NULL si no esta en trial). */
  diasRestantesTrial?: number | null;

  /**
   * Estado de vigencia del plan, calculado en backend:
   *  - 'SinVigencia' : sin FechaFinPlan (plan vitalicio / legacy).
   *  - 'Activo'      : aun dentro de vigencia.
   *  - 'EnGracia'    : vencido pero dentro de DiasGracia (puede crear con warning).
   *  - 'Vencido'     : vencido y fuera de gracia (BLOQUEO de creates).
   */
  estadoPlan?: 'SinVigencia' | 'Activo' | 'EnGracia' | 'Vencido' | string;
  /** Dias hasta FechaFinPlan. NULL si ya vencio o sin vigencia. */
  diasParaVencimiento?: number | null;
  /** Dias transcurridos desde FechaFinPlan. 0 si aun vigente. */
  diasVencido?: number;
  /** Dias de gracia configurados para el tenant (default 7). */
  diasGracia?: number;
  /** Atajo: false solo si EstadoPlan === 'Vencido'. */
  puedeCrearRecursos?: boolean;

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
  /** Dias de duracion del plan (default 30). */
  duracionDias?: number;
}

@Injectable({ providedIn: 'root' })
export class PlanService {
  private http = inject(HttpClient);
  private base = environment.api!.baseUrl + '/api/planes';

  /**
   * Stream compartido del plan + estado de vigencia. Se actualiza cada vez que
   * algun consumidor llama `obtenerMiPlan()`. Permite que multiples componentes
   * (banner sticky en layout, widget en dashboard, botones de listados)
   * reaccionen al mismo estado sin duplicar requests.
   */
  private readonly _plan$ = new BehaviorSubject<PlanTenant | null>(null);
  readonly plan$ = this._plan$.asObservable();

  /** Snapshot sincrono del ultimo plan cargado, util para verificaciones puntuales. */
  get planActual(): PlanTenant | null { return this._plan$.value; }

  /** Devuelve plan + uso actual del tenant logueado y refresca `plan$`. */
  obtenerMiPlan(): Observable<PlanTenant | null> {
    return this.http.get<ApiResponse<PlanTenant>>(this.base + '/mi-plan').pipe(
      map(r => r?.data ?? null),
      tap(p => this._plan$.next(p))
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
