import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzEmptyModule } from 'ng-zorro-antd/empty';

export interface CardField {
  key: string;
  label: string;
  icon?: string;
  format?: (value: any, item: any) => string;
}

export interface CardConfig {
  titleKey: string;
  subtitleKey?: string;
  iconKey?: string;
  iconType?: string;
  statusKey?: string;
  fields: CardField[];
}

export interface CardAction {
  label: string;
  icon: string;
  color?: 'default' | 'primary' | 'danger';
  action: (item: any) => void;
  /** Opcional: si retorna false, la acción se oculta para ese item. */
  visible?: (item: any) => boolean;
}

@Component({
  selector: 'app-card-grid',
  standalone: true,
  imports: [CommonModule, NzButtonModule, NzIconModule, NzToolTipModule, NzEmptyModule],
  templateUrl: './card-grid.component.html',
  styleUrl: './card-grid.component.css'
})
export class CardGridComponent {
  @Input() items: any[] = [];
  @Input() config!: CardConfig;
  @Input() actions: CardAction[] = [];
  @Input() loading = false;
  @Input() emptyText = 'No hay datos disponibles';
  @Output() cardClick = new EventEmitter<any>();

  getValue(item: any, key: string): any {
    return key.split('.').reduce((acc, part) => acc?.[part], item);
  }

  formatField(item: any, field: CardField): string {
    const value = this.getValue(item, field.key);
    if (field.format) return field.format(value, item);
    return value ?? '—';
  }

  getInitial(item: any): string {
    const title = this.getValue(item, this.config.titleKey);
    return (title || '?').toString().charAt(0).toUpperCase();
  }

  getStatus(item: any): { active: boolean; label: string } {
    if (!this.config.statusKey) return { active: true, label: 'Activo' };
    const value = this.getValue(item, this.config.statusKey);
    const active = value === true || value === 'Activo';
    return { active, label: active ? 'Activo' : 'Inactivo' };
  }

  trackByFn(index: number, item: any): any {
    return item.id || item._id || index;
  }
}
