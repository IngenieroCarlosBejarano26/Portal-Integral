import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../../../core/services/base-api.service';
import { environment } from '../../../../environments/environment.local';

/** Vista de la configuración (sin password) que devuelve el backend. */
export interface ConfiguracionEmail {
  configuracionEmailId: string;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  fromEmail: string;
  fromName: string;
  enableSsl: boolean;
  activo: boolean;
  fechaCreacion: string;
  fechaModificacion?: string;
  /** true si ya hay password almacenada (para indicar al usuario que puede dejarla vacía al editar). */
  tienePassword: boolean;
}

/** Payload para crear/actualizar — la password viaja en CLARO y el backend la cifra antes de guardar. */
export interface GuardarConfiguracionEmail {
  configuracionEmailId?: string;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  /** En update: déjalo vacío para conservar la password actual. */
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  enableSsl: boolean;
  activo: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfiguracionEmailService {
  private http = inject(HttpClient);
  private endpoint = environment.api!.baseUrl + '/api/configuracion-email';

  /** Devuelve la configuración SMTP activa o `null` si no hay ninguna registrada. */
  obtenerActiva(): Observable<ConfiguracionEmail | null> {
    return this.http
      .get<ApiResponse<ConfiguracionEmail | null>>(`${this.endpoint}/activa`)
      .pipe(map(res => res?.data ?? null));
  }

  guardar(dto: GuardarConfiguracionEmail): Observable<ConfiguracionEmail> {
    return this.http
      .post<ApiResponse<ConfiguracionEmail>>(this.endpoint, dto)
      .pipe(map(res => res.data!));
  }
}
