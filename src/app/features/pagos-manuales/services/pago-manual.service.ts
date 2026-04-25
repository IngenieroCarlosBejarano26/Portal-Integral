import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment.local';
import { ApiResponse } from '../../../core/services/base-api.service';

export type EstadoPago = 'Pendiente' | 'Aprobado' | 'Rechazado';
export type MetodoPago = 'Nequi' | 'Bancolombia' | 'Otro';

export interface SolicitudPagoManual {
  solicitudId: string;
  tenantId: string;
  tenantNombre?: string;
  planSolicitadoId: string;
  planNombre?: string;
  montoCOP: number;
  precioUSD: number;
  tasaCambio: number;
  metodoPago: MetodoPago;
  referenciaPago: string;
  notas?: string;
  comprobanteFileName?: string;
  comprobanteContentType?: string;
  estado: EstadoPago;
  motivoRechazo?: string;
  usuarioSolicitante: string;
  fechaSolicitud: string;
  usuarioRevisor?: string;
  fechaRevision?: string;
}

export interface CrearSolicitudPagoManual {
  planSolicitadoId: string;
  montoCOP: number;
  precioUSD: number;
  tasaCambio: number;
  metodoPago: MetodoPago;
  referenciaPago: string;
  notas?: string;
  comprobanteBase64?: string;
  comprobanteContentType?: string;
  comprobanteFileName?: string;
}

export interface InfoPagoPublica {
  nequiNumero: string;
  nequiTitular: string;
  bancolombiaCuenta: string;
  bancolombiaTipo: string;
  bancolombiaTitular: string;
  cedula: string;
}

@Injectable({ providedIn: 'root' })
export class PagoManualService {
  private http = inject(HttpClient);
  private base = environment.api!.baseUrl + '/api/pagos-manuales';

  obtenerInfoPago(): Observable<InfoPagoPublica | null> {
    return this.http.get<ApiResponse<InfoPagoPublica>>(`${this.base}/info-pago`).pipe(map(r => r?.data ?? null));
  }

  solicitar(dto: CrearSolicitudPagoManual): Observable<ApiResponse<SolicitudPagoManual>> {
    return this.http.post<ApiResponse<SolicitudPagoManual>>(`${this.base}/solicitar`, dto);
  }

  listarMisSolicitudes(): Observable<SolicitudPagoManual[]> {
    return this.http.get<ApiResponse<SolicitudPagoManual[]>>(`${this.base}/mis-solicitudes`).pipe(map(r => r?.data ?? []));
  }

  listarPendientes(): Observable<SolicitudPagoManual[]> {
    return this.http.get<ApiResponse<SolicitudPagoManual[]>>(`${this.base}/pendientes`).pipe(map(r => r?.data ?? []));
  }

  /**
   * URL absoluta del endpoint de descarga del comprobante.
   * OJO: requiere Authorization (JWT) + X-Api-Key, asi que NO sirve para
   * abrirla con `window.open(url)` (no se inyectarian los headers).
   * Para mostrarla en una pestana usa `descargarComprobante()` y
   * `URL.createObjectURL(blob)`.
   */
  comprobanteUrl(solicitudId: string): string {
    return `${this.base}/${solicitudId}/comprobante`;
  }

  /**
   * Descarga el comprobante como Blob (con auth automatica via interceptor).
   * Devuelve el blob con su Content-Type para que el caller decida si lo abre
   * en una pestana, lo embebe en un <img> o lo fuerza a descargar.
   */
  descargarComprobante(solicitudId: string): Observable<Blob> {
    return this.http.get(this.comprobanteUrl(solicitudId), { responseType: 'blob' });
  }

  aprobar(solicitudId: string): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.base}/${solicitudId}/aprobar`, {});
  }

  rechazar(solicitudId: string, motivoRechazo: string): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.base}/${solicitudId}/rechazar`, { motivoRechazo });
  }
}
