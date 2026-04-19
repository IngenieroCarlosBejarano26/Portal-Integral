import { Component, inject, OnInit, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Subject } from 'rxjs';

export interface TableColumn {
  key: string;
  title: string;
  type?: 'text' | 'badge' | 'date' | 'currency';
  width?: string;
  sortable?: boolean;
  dataFormat?: (data: any) => string;
}

export interface TableAction {
  label: string;
  icon: string;
  color?: string;
  type: 'primary' | 'default' | 'dashed' | 'text' | 'link';
  action: (record: any) => void;
}

@Component({
  selector: 'app-generic-table',
  standalone: true,
  imports: [
    CommonModule,
    NzTableModule,
    NzButtonModule,
    NzIconModule,
    NzSpaceModule,
    NzEmptyModule,
    NzModalModule,
    NzSpinModule,
    NzPopconfirmModule,
    NzPaginationModule,
    NzTagModule
  ],
  templateUrl: './generic-table.component.html',
  styleUrl: './generic-table.component.css'
})
export class GenericTableComponent<T> implements OnInit, OnDestroy {
  @Input() data: T[] = [];
  @Input() columns: TableColumn[] = [];
  @Input() actions: TableAction[] = [];
  @Input() loading = false;
  @Input() pageSize = 10;
  @Input() total = 0;
  @Input() paginated = true;
  @Input() striped = true;
  @Input() bordered = true;
  @Input() hover = true;
  @Input() size: 'large' | 'middle' | 'small' = 'middle';

  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();
  @Output() reload = new EventEmitter<void>();

  private destroy$ = new Subject<void>();

  currentPage = 1;
  pageIndex = 0;
  pageSizeOptions = [5, 10, 20, 50];
  displayedData: T[] = [];

  ngOnInit(): void {
    this.updateDisplayedData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  updateDisplayedData(): void {
    if (this.paginated) {
      const start = (this.currentPage - 1) * this.pageSize;
      const end = start + this.pageSize;
      this.displayedData = this.data.slice(start, end);
    } else {
      this.displayedData = this.data;
    }
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.pageIndex = page - 1;
    this.updateDisplayedData();
    this.pageChange.emit(page);
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.pageIndex = 0;
    this.updateDisplayedData();
    this.pageSizeChange.emit(size);
  }

  executeAction(action: TableAction, record: T): void {
    action.action(record);
  }

  trackByFn(index: number, item: T): number {
    return index;
  }

  getColumnValue(item: T, key: string): any {
    return (item as any)[key];
  }

  formatValue(item: T, column: TableColumn): string {
    const value = this.getColumnValue(item, column.key);
    
    if (column.dataFormat) {
      return column.dataFormat(value);
    }

    if (column.type === 'date' && value) {
      return new Date(value).toLocaleDateString('es-ES');
    }

    if (column.type === 'currency' && typeof value === 'number') {
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'COP'
      }).format(value);
    }

    return value || '-';
  }

  onReload(): void {
    this.reload.emit();
  }
}
