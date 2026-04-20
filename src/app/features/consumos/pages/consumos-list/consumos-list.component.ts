import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CardGridComponent, CardConfig } from '../../../../shared/components/card-grid/card-grid.component';
import { ConsumoService, Consumo } from '../../services/consumo.service';
import { ValeraService, Valera } from '../../../valeras/services/valera.service';
import { ClienteService, Cliente } from '../../../clientes/services/cliente.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { RealtimeEvents } from '../../../../core/services/realtime/realtime-events';

interface ConsumoEnriquecido extends Consumo {
  clienteNombre?: string;
  clienteDocumento?: string;
  codigoQR?: string;
  fechaConsumoFormateada?: string;
}

/**
 * Vista de HISTORIAL de consumos.
 * Los consumos se registran desde la tarjeta de Valera, no desde aquí.
 */
@Component({
  selector: 'app-consumos-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    CardGridComponent
  ],
  templateUrl: './consumos-list.component.html',
  styleUrl: './consumos-list.component.css'
})
export class ConsumusListComponent implements OnInit, OnDestroy {
  private consumoService = inject(ConsumoService);
  private valeraService = inject(ValeraService);
  private clienteService = inject(ClienteService);
  private realtime = inject(RealtimeService);
  private destroy$ = new Subject<void>();

  consumos: ConsumoEnriquecido[] = [];
  filteredConsumos: ConsumoEnriquecido[] = [];
  loading = false;
  searchValue = '';

  cardConfig: CardConfig = {
    titleKey: 'clienteNombre',
    subtitleKey: 'fechaConsumoFormateada',
    iconType: 'bar-chart',
    fields: [
      { key: 'codigoQR', label: 'Valera', icon: 'qrcode',
        format: (v) => v ? String(v).substring(0, 12) + '…' : '—' },
      { key: 'clienteDocumento', label: 'Documento', icon: 'idcard',
        format: (v) => v || '—' },
      { key: 'observaciones', label: 'Observaciones', icon: 'snippets',
        format: (v) => v || 'Consumo desde el sistema' }
    ]
  };

  ngOnInit(): void {
    this.loadAll();

    const reloadAll = () => this.loadAll();
    this.realtime.on(RealtimeEvents.Consumo.Created).pipe(takeUntil(this.destroy$)).subscribe(reloadAll);
    this.realtime.on(RealtimeEvents.Consumo.Updated).pipe(takeUntil(this.destroy$)).subscribe(reloadAll);
    this.realtime.on(RealtimeEvents.Consumo.Deleted).pipe(takeUntil(this.destroy$)).subscribe(reloadAll);
    this.realtime.on(RealtimeEvents.Valera.Created).pipe(takeUntil(this.destroy$)).subscribe(reloadAll);
    this.realtime.on(RealtimeEvents.Cliente.Updated).pipe(takeUntil(this.destroy$)).subscribe(reloadAll);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadAll(): void {
    this.loading = true;
    forkJoin({
      consumos: this.consumoService.getAll(),
      valeras: this.valeraService.getAll(),
      clientes: this.clienteService.getAll()
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ consumos, valeras, clientes }) => {
        const valMap = new Map<string, Valera>();
        valeras.forEach(v => v.valeraID && valMap.set(v.valeraID, v));

        const cliMap = new Map<string, Cliente>();
        clientes.forEach(c => c.clienteID && cliMap.set(c.clienteID, c));

        this.consumos = consumos
          .map(c => this.enrich(c, valMap, cliMap))
          .sort((a, b) => {
            const da = a.fechaConsumo ? new Date(a.fechaConsumo).getTime() : 0;
            const db = b.fechaConsumo ? new Date(b.fechaConsumo).getTime() : 0;
            return db - da;
          });

        this.applyFilter();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  private enrich(c: Consumo, valMap: Map<string, Valera>, cliMap: Map<string, Cliente>): ConsumoEnriquecido {
    const valera = c.valeraID ? valMap.get(c.valeraID) : undefined;
    const cliente = valera?.clienteID ? cliMap.get(valera.clienteID) : undefined;
    return {
      ...c,
      codigoQR: valera?.codigoQR ?? '—',
      clienteNombre: cliente
        ? `${cliente.nombre ?? ''} ${cliente.apellido ?? ''}`.trim()
        : 'Cliente desconocido',
      clienteDocumento: cliente?.documento ?? '—',
      fechaConsumoFormateada: c.fechaConsumo
        ? new Date(c.fechaConsumo).toLocaleString('es-CO')
        : 'Sin fecha'
    };
  }

  onSearch(value: string): void {
    this.searchValue = (value || '').toLowerCase();
    this.applyFilter();
  }

  private applyFilter(): void {
    const term = this.searchValue;
    if (!term) {
      this.filteredConsumos = [...this.consumos];
      return;
    }
    this.filteredConsumos = this.consumos.filter(c =>
      c.clienteNombre?.toLowerCase().includes(term) ||
      c.clienteDocumento?.toLowerCase().includes(term) ||
      c.codigoQR?.toLowerCase().includes(term) ||
      c.observaciones?.toLowerCase().includes(term)
    );
  }

  onReload(): void { this.loadAll(); }
}

