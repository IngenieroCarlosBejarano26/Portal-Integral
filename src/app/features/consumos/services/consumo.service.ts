import { Injectable } from '@angular/core';
import { ApiResponse, BaseApiService } from '../../../core/services/base-api.service';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface Consumo {
  consumoID?: string;
  valeraID?: string;
  fechaConsumo?: string;
  observaciones?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConsumoService extends BaseApiService<Consumo> {
  private consumosSubject = new BehaviorSubject<Consumo[]>([]);
  public consumos$ = this.consumosSubject.asObservable();

  getEntityName(): string {
    return 'Consumo';
  }

  loadConsumos(): Observable<Consumo[]> {
    return this.getAll().pipe(
      tap(c => this.consumosSubject.next(c))
    );
  }

  createConsumo(consumo: Partial<Consumo>): Observable<Consumo> {
    return this.create(consumo).pipe(
      tap(c => {
        this.consumosSubject.next([...this.consumosSubject.value, c]);
      })
    );
  }

  /**
   * Crea un consumo y devuelve la respuesta completa (incluido `message`)
   * para mostrarla al usuario en un modal.
   */
  createConsumoWithResponse(consumo: Partial<Consumo>): Observable<ApiResponse<Consumo>> {
    return this.createRaw(consumo).pipe(
      tap(res => {
        if (res?.success && res.data) {
          this.consumosSubject.next([...this.consumosSubject.value, res.data]);
        }
      })
    );
  }

  updateConsumo(consumo: Partial<Consumo>): Observable<Consumo> {
    return this.update(consumo).pipe(
      tap(updated => {
        const list = this.consumosSubject.value;
        const idx = list.findIndex(c => c.consumoID === updated.consumoID);
        if (idx > -1) {
          list[idx] = updated;
          this.consumosSubject.next([...list]);
        }
      })
    );
  }

  deleteConsumo(id: string): Observable<void> {
    return this.delete(id).pipe(
      tap(() => {
        this.consumosSubject.next(this.consumosSubject.value.filter(c => c.consumoID !== id));
      })
    );
  }
}
