import { Injectable, inject } from '@angular/core';
import { BaseApiService } from '../../../core/services/base-api.service';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Cliente — coincide con Domain.Entities.Cliente del backend.
 * El backend usa PascalCase pero ASP.NET por defecto serializa a camelCase.
 */
export interface Cliente {
  clienteID?: string;
  nombre?: string;
  apellido?: string;
  documento?: string;
  telefono?: string;
  email?: string;
  empresaId?: string;
  fechaRegistro?: string;
  activo?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ClienteService extends BaseApiService<Cliente> {
  private clientesSubject = new BehaviorSubject<Cliente[]>([]);
  public clientes$ = this.clientesSubject.asObservable();

  getEntityName(): string {
    return 'Cliente';
  }

  loadClientes(): Observable<Cliente[]> {
    return this.getAll().pipe(
      tap(c => this.clientesSubject.next(c))
    );
  }

  createCliente(cliente: Partial<Cliente>): Observable<Cliente> {
    return this.create(cliente).pipe(
      tap(c => {
        this.clientesSubject.next([...this.clientesSubject.value, c]);
      })
    );
  }

  updateCliente(cliente: Partial<Cliente>): Observable<Cliente> {
    return this.update(cliente).pipe(
      tap(updated => {
        const list = this.clientesSubject.value;
        const idx = list.findIndex(c => c.clienteID === updated.clienteID);
        if (idx > -1) {
          list[idx] = updated;
          this.clientesSubject.next([...list]);
        }
      })
    );
  }

  deleteCliente(id: string): Observable<void> {
    return this.delete(id).pipe(
      tap(() => {
        this.clientesSubject.next(this.clientesSubject.value.filter(c => c.clienteID !== id));
      })
    );
  }
}

