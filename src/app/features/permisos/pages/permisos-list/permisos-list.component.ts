import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NotificationService } from '../../../../core/services/notifications/notification.service';
import { RealtimeService } from '../../../../core/services/realtime/realtime.service';
import { RealtimeEvents } from '../../../../core/services/realtime/realtime-events';
import { RolService, Rol } from '../../../roles/services/rol.service';
import { Permiso, PermisoService } from '../../services/permiso.service';
import { CardGridComponent, CardConfig, CardAction } from '../../../../shared/components/card-grid/card-grid.component';

interface PermisoModuloGroup {
  modulo: string;
  permisos: Array<Permiso & { selected: boolean }>;
  /** Estado del acordeón del módulo (true = expandido). */
  expanded: boolean;
}

/** Tipos de acción disponibles para filtrar permisos en el modal. */
type ActionFilter = 'all' | 'view' | 'create' | 'update' | 'delete' | 'execute';

/** Item enriquecido para mostrar en la grid — añade el conteo de permisos asignados. */
interface RolCardItem extends Rol {
  permisosAsignados: number;
  permisosTotal: number;
}

@Component({
  selector: 'app-permisos-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    NzButtonModule, NzIconModule, NzCheckboxModule,
    NzSwitchModule, NzInputModule,
    NzModalModule, NzSpinModule, NzEmptyModule,
    CardGridComponent
  ],
  templateUrl: './permisos-list.component.html',
  styleUrl: './permisos-list.component.css'
})
export class PermisosListComponent implements OnInit, OnDestroy {
  private rolService = inject(RolService);
  private permisoService = inject(PermisoService);
  private notification = inject(NotificationService);
  private realtime = inject(RealtimeService);
  private modal = inject(NzModalService);
  private destroy$ = new Subject<void>();

  loading = false;
  saving = false;
  roles: Rol[] = [];
  allPermisos: Permiso[] = [];

  /** Búsqueda de roles en la lista principal. */
  searchValue = '';

  /** Mapa de conteo de permisos asignados por rolId (para el badge en la card). */
  asignadosPorRol = new Map<string, number>();

  /** Rol actualmente seleccionado para edición de permisos. */
  selectedRol: Rol | null = null;
  /** Grupos de permisos agrupados por módulo (estado del modal). */
  groups: PermisoModuloGroup[] = [];

  /** Término de búsqueda dentro del modal. */
  searchTerm = '';
  /** Filtro de acción activo. 'all' = sin filtro. */
  actionFilter: ActionFilter = 'all';

  /** Catálogo de acciones disponibles para los chips de filtro. */
  readonly actionTypes: Array<{ key: ActionFilter; label: string; }> = [
    { key: 'all',     label: 'Todas' },
    { key: 'view',    label: 'Ver' },
    { key: 'create',  label: 'Crear' },
    { key: 'update',  label: 'Editar' },
    { key: 'delete',  label: 'Eliminar' },
    { key: 'execute', label: 'Ejecutar' }
  ];

  // ===========================================================================
  // Configuración de la grid principal (mismo diseño que el resto de módulos)
  // ===========================================================================

  cardConfig: CardConfig = {
    titleKey: 'nombre',
    subtitleKey: 'descripcion',
    iconType: 'safety',
    fields: [
      {
        key: 'permisosAsignados',
        label: 'Permisos asignados',
        icon: 'safety-certificate',
        format: (_v: any, item: any) => {
          const it = item as RolCardItem;
          return `${it.permisosAsignados} de ${it.permisosTotal}`;
        }
      }
    ]
  };

  cardActions: CardAction[] = [
    {
      label: 'Configurar permisos',
      icon: 'setting',
      color: 'primary',
      action: (item: any) => this.openRolPermisos(item as Rol)
    }
  ];

  ngOnInit(): void {
    this.loadAll();

    // Si la matriz cambia desde otra sesión, recargamos.
    this.realtime.on(RealtimeEvents.Permiso.Updated)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadAll());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadAll(): void {
    this.loading = true;
    forkJoin({
      roles: this.rolService.getAll(),
      permisos: this.permisoService.getAll()
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ roles, permisos }) => {
        this.roles = roles ?? [];
        this.allPermisos = permisos ?? [];
        this.loadAsignadosPorRol();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  /** Carga el conteo de permisos asignados por cada rol (en paralelo). */
  private loadAsignadosPorRol(): void {
    if (!this.roles.length) return;
    const reqs = this.roles
      .filter(r => !!r.rolId)
      .map(r => this.permisoService.getByRol(r.rolId!).pipe(
        takeUntil(this.destroy$)
      ));
    forkJoin(reqs).subscribe(results => {
      this.asignadosPorRol = new Map(
        this.roles
          .filter(r => !!r.rolId)
          .map((r, i) => [r.rolId!, results[i].length])
      );
    });
  }

  /** Items que recibe la grid — enriquecidos con el conteo de permisos y filtrados por búsqueda. */
  get filteredRoles(): RolCardItem[] {
    const term = this.searchValue.trim().toLowerCase();
    return this.roles
      .filter(r => !term
        || (r.nombre ?? '').toLowerCase().includes(term)
        || (r.descripcion ?? '').toLowerCase().includes(term))
      .map(r => ({
        ...r,
        permisosAsignados: this.asignadosPorRol.get(r.rolId ?? '') ?? 0,
        permisosTotal: this.allPermisos.length
      }));
  }

  onSearch(value: string): void { this.searchValue = value; }
  onReload(): void { this.loadAll(); }

  /** Abre el modal de edición de permisos del rol seleccionado. */
  openRolPermisos(rol: Rol): void {
    if (!rol.rolId) return;
    this.selectedRol = rol;
    this.saving = false;
    this.searchTerm = '';
    this.actionFilter = 'all';

    // Cargamos los permisos asignados al rol y construimos el modelo del modal.
    this.permisoService.getByRol(rol.rolId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(asignados => {
        const codigosAsignados = new Set(asignados.map(p => p.permisoId));
        this.groups = this.groupByModulo(
          this.allPermisos.map(p => ({ ...p, selected: codigosAsignados.has(p.permisoId) }))
        );
      });
  }

  /** Cierra el modal sin guardar. */
  closeRolPermisos(): void {
    this.selectedRol = null;
    this.groups = [];
  }

  /** Marca/desmarca todos los permisos de un módulo. */
  toggleModulo(group: PermisoModuloGroup): void {
    const allSelected = group.permisos.every(p => p.selected);
    group.permisos.forEach(p => p.selected = !allSelected);
  }

  isModuloAllSelected(group: PermisoModuloGroup): boolean {
    return group.permisos.length > 0 && group.permisos.every(p => p.selected);
  }

  isModuloIndeterminate(group: PermisoModuloGroup): boolean {
    const sel = group.permisos.filter(p => p.selected).length;
    return sel > 0 && sel < group.permisos.length;
  }

  /** Cuenta total de permisos seleccionados en el modal. */
  get totalSelected(): number {
    return this.groups.reduce((acc, g) => acc + g.permisos.filter(p => p.selected).length, 0);
  }

  /** Persiste la selección actual contra el backend. */
  save(): void {
    if (!this.selectedRol?.rolId) return;
    const permisoIds = this.groups
      .flatMap(g => g.permisos.filter(p => p.selected).map(p => p.permisoId));

    this.saving = true;
    this.permisoService.assignToRol(this.selectedRol.rolId, permisoIds)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notification.success('Permisos actualizados',
            `${permisoIds.length} permiso(s) asignado(s) al rol "${this.selectedRol?.nombre}".`);
          // Actualizamos el contador de la card sin recargar todo.
          if (this.selectedRol?.rolId) {
            this.asignadosPorRol.set(this.selectedRol.rolId, permisoIds.length);
            // Forzamos nueva referencia para que la grid re-renderice los conteos.
            this.asignadosPorRol = new Map(this.asignadosPorRol);
          }
          this.saving = false;
          this.closeRolPermisos();
        },
        error: () => { this.saving = false; }
      });
  }

  /** Agrupa permisos por módulo y ordena cada grupo por prioridad de acción (CRUD). */
  private groupByModulo(items: Array<Permiso & { selected: boolean }>): PermisoModuloGroup[] {
    const map = new Map<string, Array<Permiso & { selected: boolean }>>();
    for (const p of items) {
      if (!map.has(p.modulo)) map.set(p.modulo, []);
      map.get(p.modulo)!.push(p);
    }
    const order: Record<string, number> = {
      view: 0, create: 1, update: 2, delete: 3, execute: 4
    };
    return Array.from(map.entries())
      .map(([modulo, permisos]) => ({
        modulo,
        permisos: permisos.sort(
          (a, b) => (order[a.accion] ?? 99) - (order[b.accion] ?? 99)),
        expanded: false   // por defecto colapsado para una vista limpia
      }))
      .sort((a, b) => a.modulo.localeCompare(b.modulo));
  }

  // ===========================================================================
  // Helpers para filtros (búsqueda + tipo de acción)
  // ===========================================================================

  /** Devuelve los permisos del grupo que pasan los filtros activos. */
  filteredPermisos(group: PermisoModuloGroup): Array<Permiso & { selected: boolean }> {
    const term = this.searchTerm.trim().toLowerCase();
    return group.permisos.filter(p => {
      if (this.actionFilter !== 'all' && p.accion !== this.actionFilter) return false;
      if (!term) return true;
      return p.nombre.toLowerCase().includes(term)
          || p.codigo.toLowerCase().includes(term)
          || (p.descripcion ?? '').toLowerCase().includes(term);
    });
  }

  /** Grupos visibles tras aplicar filtros (oculta los módulos sin matches). */
  get visibleGroups(): PermisoModuloGroup[] {
    return this.groups.filter(g => this.filteredPermisos(g).length > 0);
  }

  /** Limpia búsqueda + filtro. */
  clearFilters(): void {
    this.searchTerm = '';
    this.actionFilter = 'all';
  }

  /** Selecciona/deselecciona TODOS los permisos visibles tras los filtros (incluye todos los módulos). */
  toggleAllVisible(select: boolean): void {
    for (const g of this.visibleGroups) {
      for (const p of this.filteredPermisos(g)) p.selected = select;
    }
  }

  // ===========================================================================
  // Acordeón por módulo
  // ===========================================================================

  /** Cantidad de permisos activos en un grupo (para mostrar X/Y en el header). */
  selectedCountInGroup(group: PermisoModuloGroup): number {
    return group.permisos.filter(p => p.selected).length;
  }

  /** Alterna expandido/colapsado de un módulo. */
  toggleGroup(group: PermisoModuloGroup, event?: Event): void {
    event?.stopPropagation();
    group.expanded = !group.expanded;
  }

  /** Expande todos los grupos visibles. */
  expandAll(): void {
    for (const g of this.visibleGroups) g.expanded = true;
  }

  /** Colapsa todos los grupos. */
  collapseAll(): void {
    for (const g of this.groups) g.expanded = false;
  }

  /**
   * Cuando hay un filtro activo (búsqueda o acción) auto-expandimos los grupos
   * que tienen matches para que el usuario vea inmediatamente los resultados.
   */
  private autoExpandOnFilter(): void {
    const filtering = this.searchTerm.trim().length > 0 || this.actionFilter !== 'all';
    if (!filtering) return;
    for (const g of this.visibleGroups) g.expanded = true;
  }

  /** Llamado desde la UI cuando cambia búsqueda o filtro. */
  onFiltersChanged(): void {
    this.autoExpandOnFilter();
  }

  trackByGroup(_: number, g: PermisoModuloGroup): string { return g.modulo; }
  trackByPermiso(_: number, p: Permiso): string { return p.permisoId; }
}
