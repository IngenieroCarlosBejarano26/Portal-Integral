import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../../../core/services/base-api.service';
import { environment } from '../../../../environments/environment.local';

export interface EnviarMenuDelDiaDto {
  asunto: string;
  cuerpoHtml: string;
}

export interface EnviarMenuDelDiaResultadoDto {
  destinatarios: number;
  enviados: number;
  fallidos: number;
}

@Injectable({ providedIn: 'root' })
export class ComunicacionService {
  private http = inject(HttpClient);
  private base = environment.api!.baseUrl + '/api/comunicacion';

  enviarMenuDelDia(dto: EnviarMenuDelDiaDto): Observable<EnviarMenuDelDiaResultadoDto> {
    return this.http
      .post<ApiResponse<EnviarMenuDelDiaResultadoDto>>(`${this.base}/menu-del-dia`, dto)
      .pipe(map((res) => res.data!));
  }
}
