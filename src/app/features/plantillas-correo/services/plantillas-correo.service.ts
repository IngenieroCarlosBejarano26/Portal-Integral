import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../../../core/services/base-api.service';
import { environment } from '../../../../environments/environment.local';

export interface PlantillaEmailDto {
  codigo: string;
  asunto: string;
  cuerpoHtml: string;
  descripcion?: string;
}

export interface GuardarPlantillaEmailDto {
  codigo: string;
  asunto: string;
  cuerpoHtml: string;
}

@Injectable({ providedIn: 'root' })
export class PlantillasCorreoService {
  private http = inject(HttpClient);
  private endpoint = environment.api!.baseUrl + '/api/plantillas-email';

  listar(): Observable<PlantillaEmailDto[]> {
    return this.http.get<ApiResponse<PlantillaEmailDto[]>>(this.endpoint).pipe(
      map((res) => res?.data ?? [])
    );
  }

  guardar(dto: GuardarPlantillaEmailDto): Observable<boolean> {
    return this.http.post<ApiResponse<boolean>>(this.endpoint, dto).pipe(
      map((res) => !!res?.success)
    );
  }
}
