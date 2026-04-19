import { Injectable, inject, OnDestroy } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel
} from '@microsoft/signalr';
import { Observable, Subject, filter, map } from 'rxjs';
import { environment } from '../../../../environments/environment.local';
import { AuthService } from '../auth/authService';
import { RealtimeEventName } from './realtime-events';

interface RealtimeMessage {
  event: string;
  payload: any;
}

/**
 * Servicio singleton que gestiona la conexión SignalR con el backend.
 *
 * Responsabilidades:
 * - Mantener una única conexión activa
 * - Reconexión automática
 * - Exponer un stream de eventos que cualquier componente puede suscribir con `on(eventName)`
 *
 * Uso:
 * ```ts
 * realtime.on(RealtimeEvents.Empresa.Created)
 *   .pipe(takeUntil(this.destroy$))
 *   .subscribe(payload => this.reload());
 * ```
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService implements OnDestroy {
  private authService = inject(AuthService);
  private connection?: HubConnection;
  private events$ = new Subject<RealtimeMessage>();
  private readonly hubPath = '/hubs/portal';
  private subscribedEvents = new Set<string>();

  /** Inicia la conexión si todavía no está activa. Idempotente. */
  async connect(): Promise<void> {
    if (this.connection?.state === HubConnectionState.Connected ||
        this.connection?.state === HubConnectionState.Connecting) {
      return;
    }

    const token = this.authService.getToken();
    if (!token) return;

    const url = `${environment.api!.baseUrl}${this.hubPath}`;

    this.connection = new HubConnectionBuilder()
      .withUrl(url, { accessTokenFactory: () => this.authService.getToken() ?? '' })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(environment.production ? LogLevel.Warning : LogLevel.Information)
      .build();

    try {
      await this.connection.start();
      // Re-suscribir eventos previamente solicitados (en caso de reconexión)
      this.subscribedEvents.forEach(evt => this.bindHandler(evt));
    } catch (err) {
      console.error('[Realtime] Error iniciando conexión SignalR:', err);
    }
  }

  /** Cierra la conexión activa. */
  async disconnect(): Promise<void> {
    if (this.connection) {
      try { await this.connection.stop(); } catch { /* ignore */ }
      this.connection = undefined;
      this.subscribedEvents.clear();
    }
  }

  /**
   * Devuelve un Observable que emite cuando llega el evento indicado.
   * Asegura el binding en el hub solo una vez por evento.
   */
  on<T = any>(event: RealtimeEventName | string): Observable<T> {
    if (!this.subscribedEvents.has(event)) {
      this.subscribedEvents.add(event);
      this.bindHandler(event);
    }
    return this.events$.pipe(
      filter(msg => msg.event === event),
      map(msg => msg.payload as T)
    );
  }

  private bindHandler(event: string): void {
    if (!this.connection) return;
    this.connection.off(event); // evita duplicados
    this.connection.on(event, (payload: any) => {
      this.events$.next({ event, payload });
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
