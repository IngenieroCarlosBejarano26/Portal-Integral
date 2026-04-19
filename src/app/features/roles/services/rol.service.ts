import { Injectable } from '@angular/core';
import { BaseApiService } from '../../../core/services/base-api.service';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface Rol {
  rolId?: string;
  nombre?: string;
  descripcion?: string;
  fechaCreacion?: string;
}

@Injectable({ providedIn: 'root' })
export class RolService extends BaseApiService<Rol> {
  private rolesSubject = new BehaviorSubject<Rol[]>([]);
  public roles$ = this.rolesSubject.asObservable();

  getEntityName(): string { return 'Rol'; }

  loadRoles(): Observable<Rol[]> {
    return this.getAll().pipe(tap(r => this.rolesSubject.next(r)));
  }

  createRol(rol: Partial<Rol>): Observable<Rol> {
    return this.create(rol).pipe(tap(r => {
      this.rolesSubject.next([...this.rolesSubject.value, r]);
    }));
  }

  updateRol(rol: Partial<Rol>): Observable<Rol> {
    return this.update(rol).pipe(tap(updated => {
      const list = this.rolesSubject.value;
      const idx = list.findIndex(r => r.rolId === updated.rolId);
      if (idx > -1) {
        list[idx] = updated;
        this.rolesSubject.next([...list]);
      }
    }));
  }

  deleteRol(id: string): Observable<void> {
    return this.delete(id).pipe(tap(() => {
      this.rolesSubject.next(this.rolesSubject.value.filter(r => r.rolId !== id));
    }));
  }
}
