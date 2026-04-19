import { Injectable } from '@angular/core';
import { BaseApiService } from '../../../core/services/base-api.service';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface Valera {
  valeraID?: string;
  clienteID?: string;
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
}
