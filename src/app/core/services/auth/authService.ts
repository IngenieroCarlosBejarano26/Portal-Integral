import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment.local';

interface LoginRequest {
  nombreUsuario: string;
  password: string;
}

/**
 * Forma real devuelta por el backend en `POST /api/Auth/login`.
 * Coincide con `Application.Features.Auth.DTOs.LoginResponseDto`.
 */
interface LoginResponseDto {
  token: string;
  expiracion: string;
  nombreUsuario: string;
  rol: string;
  tenant: string;
}

export interface CurrentUser {
  nombreUsuario: string;
  rol: string;
  tenant: string;
  expiracion?: string;
  /** Extraídos del JWT cuando están disponibles. */
  usuarioId?: string;
  email?: string;
  tenantId?: string;
}

interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private currentUserSubject = new BehaviorSubject<CurrentUser | null>(this.readStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'current_user';

  login(credentials: LoginRequest): Observable<boolean> {
    const url = `${environment.api!.baseUrl}/api/Auth/login`;

    return this.http.post<ApiResponse<LoginResponseDto>>(url, credentials).pipe(
      map((response) => {
        const dto = response?.data;
        if (!dto?.token) return false;

        localStorage.setItem(this.TOKEN_KEY, dto.token);

        // Construir el usuario actual combinando la respuesta del backend
        // con los claims adicionales que vienen en el JWT (usuarioId, email, tenantId).
        const claims = this.decodeJwt(dto.token);
        const user: CurrentUser = {
          nombreUsuario: dto.nombreUsuario,
          rol: dto.rol,
          tenant: dto.tenant,
          expiracion: dto.expiracion,
          usuarioId: claims?.sub,
          email: claims?.email,
          tenantId: claims?.tenantId
        };

        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        this.currentUserSubject.next(user);
        return true;
      }),
      // La navegación post-login la hace el LoginComponent (necesita leer returnUrl).
      catchError((error) => {
        console.error('Login failed:', error);
        return throwError(() => error);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getCurrentUser(): CurrentUser | null {
    return this.currentUserSubject.value;
  }

  /**
   * Devuelve la lista de códigos de permisos del usuario actual,
   * extraídos del claim `permisos` del JWT.
   */
  getPermissions(): string[] {
    const token = this.getToken();
    if (!token) return [];
    const claims = this.decodeJwt(token);
    const raw = claims?.permisos;
    if (!raw || typeof raw !== 'string') return [];
    return raw.split(/\s+/).filter((p: string) => !!p);
  }

  /**
   * Comprueba si el usuario tiene un permiso (o cualquiera de una lista).
   * Admin (rol === 'Admin') tiene acceso total como fallback.
   */
  hasPermission(code: string | string[]): boolean {
    const role = this.getCurrentUser()?.rol;
    if (role && role.toLowerCase() === 'admin') return true;

    const granted = this.getPermissions();
    if (!granted.length) return false;
    const codes = Array.isArray(code) ? code : [code];
    return codes.some(c => granted.includes(c));
  }

  /** Recupera el usuario almacenado al recargar la página (rehidratación). */
  private readStoredUser(): CurrentUser | null {
    try {
      const raw = localStorage.getItem('current_user');
      return raw ? JSON.parse(raw) as CurrentUser : null;
    } catch {
      return null;
    }
  }

  /** Decodifica el payload del JWT sin verificar la firma (sólo para leer claims). */
  private decodeJwt(token: string): any | null {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  hasValidToken(): boolean {
    const token = this.getToken();
    if (!token) return false;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  /** Obtiene los usuarios del tenant actual (extraído del JWT). */
  getUsuariosByTenant(): Observable<any[]> {
    const token = this.getToken();
    if (!token) return of([]);
    let tenantId: string | null = null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      tenantId = payload.tenantId || payload.tid || null;
    } catch { /* ignore */ }
    if (!tenantId) return of([]);

    const url = `${environment.api!.baseUrl}/api/Auth/usuarios/${tenantId}`;
    return this.http.get<ApiResponse<any[]>>(url).pipe(
      map(res => res?.data ?? []),
      catchError(() => of([]))
    );
  }

  /**
   * Obtiene el total de usuarios del tenant actual via endpoint ligero
   * `GET /api/Auth/usuarios/{tenantId}/count` (sólo SELECT COUNT(*)).
   */
  getUsuariosCountByTenant(): Observable<number> {
    const token = this.getToken();
    if (!token) return of(0);
    let tenantId: string | null = null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      tenantId = payload.tenantId || payload.tid || null;
    } catch { /* ignore */ }
    if (!tenantId) return of(0);

    const url = `${environment.api!.baseUrl}/api/Auth/usuarios/${tenantId}/count`;
    return this.http.get<ApiResponse<number>>(url).pipe(
      map(res => res?.data ?? 0),
      catchError(() => of(0))
    );
  }
}
