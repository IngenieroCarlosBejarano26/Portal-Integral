import { Injectable } from '@angular/core';
import { BaseApiService } from '../../../core/services/base-api.service';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface Tenant {
  tenantId?: string;
  nombre?: string;
  connectionString?: string;
  activo?: boolean;
  fechaCreacion?: string;
}

@Injectable({ providedIn: 'root' })
export class TenantService extends BaseApiService<Tenant> {
  private tenantsSubject = new BehaviorSubject<Tenant[]>([]);
  public tenants$ = this.tenantsSubject.asObservable();

  getEntityName(): string { return 'Tenant'; }

  loadTenants(): Observable<Tenant[]> {
    return this.getAll().pipe(tap(t => this.tenantsSubject.next(t)));
  }

  createTenant(tenant: Partial<Tenant>): Observable<Tenant> {
    return this.create(tenant).pipe(tap(t => {
      this.tenantsSubject.next([...this.tenantsSubject.value, t]);
    }));
  }

  updateTenant(tenant: Partial<Tenant>): Observable<Tenant> {
    return this.update(tenant).pipe(tap(updated => {
      const list = this.tenantsSubject.value;
      const idx = list.findIndex(t => t.tenantId === updated.tenantId);
      if (idx > -1) {
        list[idx] = updated;
        this.tenantsSubject.next([...list]);
      }
    }));
  }

  deleteTenant(id: string): Observable<void> {
    return this.delete(id).pipe(tap(() => {
      this.tenantsSubject.next(this.tenantsSubject.value.filter(t => t.tenantId !== id));
    }));
  }
}
