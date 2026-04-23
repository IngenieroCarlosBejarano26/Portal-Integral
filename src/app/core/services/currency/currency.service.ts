import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;
  rates: { [code: string]: number };
}

/**
 * Servicio para obtener la tasa de cambio USD->COP en tiempo real.
 * - Usa la API gratuita de Frankfurter (mantenida por el Banco Central Europeo).
 * - Cachea la tasa por 6 horas en memoria + localStorage para evitar requests
 *   innecesarios y sobrevivir a reloads.
 * - Si la API falla, usa una tasa fallback razonable (~4000 COP/USD).
 */
@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private http = inject(HttpClient);

  private readonly STORAGE_KEY = 'usd_cop_rate';
  private readonly CACHE_HOURS = 6;
  private readonly FALLBACK_RATE = 4000; // COP por 1 USD

  private rateSubject = new BehaviorSubject<number>(this.readCached() ?? this.FALLBACK_RATE);
  public rate$ = this.rateSubject.asObservable();

  constructor() {
    // Cargar tasa fresca al arrancar si el cache esta vencido o no existe.
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

  /** Refresca la tasa desde la API (devuelve la tasa nueva). */
  fetchUsdToCop(): Observable<number> {
    return this.http
      .get<FrankfurterResponse>('https://api.frankfurter.app/latest?from=USD&to=COP')
      .pipe(
        map(res => res?.rates?.['COP'] ?? this.FALLBACK_RATE),
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
