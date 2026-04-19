import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment.local';

/** Estructura estándar de respuesta del backend */
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: string[];
}

@Injectable({
  providedIn: 'root'
})
export abstract class BaseApiService<T> {
  protected http = inject(HttpClient);
  protected apiUrl = environment.api!.baseUrl;

  protected get endpoint(): string {
    return this.apiUrl + '/api/' + this.getEntityName();
  }

  abstract getEntityName(): string;

  getAll(): Observable<T[]> {
    return this.http.get<ApiResponse<T[]>>(this.endpoint).pipe(
      map(res => res?.data ?? [])
    );
  }

  /**
   * Obtiene el total de registros via endpoint ligero `GET /api/<entidad>/count`.
   * Devuelve un escalar INT en lugar de la lista completa.
   */
  getCount(): Observable<number> {
    return this.http.get<ApiResponse<number>>(`${this.endpoint}/count`).pipe(
      map(res => res?.data ?? 0)
    );
  }

  getById(id: string): Observable<T | undefined> {
    return this.http.get<ApiResponse<T>>(`${this.endpoint}/${id}`).pipe(
      map(res => res?.data)
    );
  }

  create(item: Partial<T>): Observable<T> {
    return this.http.post<ApiResponse<T>>(this.endpoint, item).pipe(
      map(res => res?.data as T)
    );
  }

  /**
   * Variante de create que devuelve la respuesta cruda del backend, incluyendo
   * `message`. Útil cuando la UI necesita mostrar el mensaje del servidor.
   */
  createRaw(item: Partial<T>): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(this.endpoint, item);
  }

  update(item: Partial<T>): Observable<T> {
    return this.http.put<ApiResponse<T>>(this.endpoint, item).pipe(
      map(res => res?.data as T)
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.endpoint}/${id}`).pipe(
      map(() => undefined)
    );
  }
}

