import { Injectable } from '@angular/core';
import { BaseApiService } from '../../../core/services/base-api.service';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface Empresa {
  empresaId?: string;
  nombre?: string;
  fechaCreacion?: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmpresaService extends BaseApiService<Empresa> {
  private empresasSubject = new BehaviorSubject<Empresa[]>([]);
  public empresas$ = this.empresasSubject.asObservable();

  getEntityName(): string {
    return 'Empresa';
  }

  loadEmpresas(): Observable<Empresa[]> {
    return this.getAll().pipe(
      tap(e => this.empresasSubject.next(e))
    );
  }

  createEmpresa(empresa: Partial<Empresa>): Observable<Empresa> {
    return this.create(empresa).pipe(
      tap(e => {
        this.empresasSubject.next([...this.empresasSubject.value, e]);
      })
    );
  }

  updateEmpresa(empresa: Partial<Empresa>): Observable<Empresa> {
    return this.update(empresa).pipe(
      tap(updated => {
        const list = this.empresasSubject.value;
        const idx = list.findIndex(e => e.empresaId === updated.empresaId);
        if (idx > -1) {
          list[idx] = updated;
          this.empresasSubject.next([...list]);
        }
      })
    );
  }

  deleteEmpresa(id: string): Observable<void> {
    return this.delete(id).pipe(
      tap(() => {
        this.empresasSubject.next(this.empresasSubject.value.filter(e => e.empresaId !== id));
      })
    );
  }
}

