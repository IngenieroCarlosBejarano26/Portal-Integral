import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiResponse } from '../base-api.service';
import { environment } from '../../../../environments/environment.local';

/** Payload devuelto por GET /api/tasa-cambio del backend Valeras. */
interface TasaCambioDto {
  from: string;
  to: string;
  rate: number;
  date: string;
}

/**
 * Servicio para obtener la tasa de cambio USD->COP en tiempo real.
 *
 * Consume el endpoint `GET /api/tasa-cambio` de nuestro backend, que actúa
 * como proxy hacia el proveedor externo (Frankfurter). Esto evita problemas
 * de CORS/preflight redirect al llamar APIs públicas directamente desde la SPA
 * y permite cachear/cambiar el proveedor sin tocar el frontend.
 *
 * Estrategia de cache:
 *  - 6 horas en memoria (BehaviorSubject) + localStorage para sobrevivir reloads.
 *  - Si el backend falla, usa una tasa fallback razonable (~4000 COP/USD).
 */
@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private http = inject(HttpClient);

  private readonly STORAGE_KEY = 'usd_cop_rate';
  private readonly CACHE_HOURS = 6;
  private readonly FALLBACK_RATE = 4000; // COP por 1 USD
  private readonly endpoint = `${environment.api!.baseUrl}/api/tasa-cambio`;

  private rateSubject = new BehaviorSubject<number>(this.readCached() ?? this.FALLBACK_RATE);
  public rate$ = this.rateSubject.asObservable();

  constructor() {
    if (!this.readCached()) {
      this.fetchUsdToCop().subscribe();
    }
  }

  /** Obtiene la tasa actual en memoria (instantaneo). */
  getRate(): number {
    return this.rateSubject.value;
  }

  /** Convierte un valor USD a COP usando la tasa actual. */
  toCop(usd: number): number {
    return usd * this.rateSubject.value;
  }

  /** Refresca la tasa desde el backend (devuelve la tasa nueva). */
  fetchUsdToCop(): Observable<number> {
    const url = `${this.endpoint}?from=USD&to=COP`;
    return this.http.get<ApiResponse<TasaCambioDto>>(url).pipe(
      map(res => res?.data?.rate ?? this.FALLBACK_RATE),
      tap(rate => {
        this.rateSubject.next(rate);
        this.writeCache(rate);
      }),
      catchError(() => of(this.FALLBACK_RATE))
    );
  }

  // --- cache helpers ---

  private readCached(): number | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      const { rate, ts } = JSON.parse(raw) as { rate: number; ts: number };
      const ageHours = (Date.now() - ts) / (1000 * 60 * 60);
      return ageHours < this.CACHE_HOURS ? rate : null;
    } catch {
      return null;
    }
  }

  private writeCache(rate: number): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ rate, ts: Date.now() }));
    } catch { /* ignore */ }
  }
}
