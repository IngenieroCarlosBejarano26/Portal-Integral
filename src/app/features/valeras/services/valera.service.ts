import { Injectable } from '@angular/core';
import { BaseApiService, ApiResponse } from '../../../core/services/base-api.service';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';

export interface Valera {
  valeraID?: string;
  clienteID?: string;
  descripcion?: string;
  fechaCompra?: string;
  fechaVencimiento?: string;
  totalAlmuerzos?: number;
  almuerzosConsumidos?: number;
  precioPagado?: number;
  estado?: boolean;
  codigoQR?: string;

  // Campos derivados (poblados en frontend con join de clientes)
  clienteNombre?: string;
  clienteDocumento?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ValeraService extends BaseApiService<Valera> {
  private valerasSubject = new BehaviorSubject<Valera[]>([]);
  public valeras$ = this.valerasSubject.asObservable();

  getEntityName(): string {
    return 'Valera';
  }

  loadValeras(): Observable<Valera[]> {
    return this.getAll().pipe(
      tap(valeras => this.valerasSubject.next(valeras))
    );
  }

  createValera(valera: Partial<Valera>): Observable<Valera> {
    return this.create(valera).pipe(
      tap(newValera => {
        const currentValeras = this.valerasSubject.value;
        this.valerasSubject.next([...currentValeras, newValera]);
      })
    );
  }

  updateValera(valera: Partial<Valera>): Observable<Valera> {
    return this.update(valera).pipe(
      tap(updatedValera => {
        const currentValeras = this.valerasSubject.value;
        const index = currentValeras.findIndex(v => v.valeraID === updatedValera.valeraID);
        if (index > -1) {
          currentValeras[index] = updatedValera;
          this.valerasSubject.next([...currentValeras]);
        }
      })
    );
  }

  deleteValera(id: string): Observable<void> {
    return this.delete(id).pipe(
      tap(() => {
        const currentValeras = this.valerasSubject.value.filter(v => v.valeraID !== id);
        this.valerasSubject.next(currentValeras);
      })
    );
  }

  /**
   * Resuelve una valera por su código QR escaneado.
   * Devuelve `null` si no existe (404 controlado).
   */
  getByCodigoQR(codigoQR: string): Observable<Valera | null> {
    return this.http
      .get<ApiResponse<Valera>>(`${this.endpoint}/by-qr/${codigoQR}`)
      .pipe(map(res => res?.data ?? null));
  }
}
