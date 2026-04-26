import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzModalRef, NZ_MODAL_DATA } from 'ng-zorro-antd/modal';

export type FormFieldType = 'text' | 'email' | 'password' | 'number' | 'currency' | 'textarea' | 'select' | 'switch' | 'date' | 'datetime';

export interface FormField {
  key: string;
  label: string;
  type: FormFieldType;
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: any }[];
  span?: 12 | 24;
  prefix?: string;
  /**
   * Modo en el que el campo es visible:
   * - 'create' → sólo al crear (nunca al editar).
   * - 'edit'   → sólo al editar (nunca al crear).
   * - 'both' (por defecto) → siempre visible.
   */
  mode?: 'create' | 'edit' | 'both';

  // ====== Validadores adicionales (opcional) ======
  /** Longitud mínima (texto). */
  minLength?: number;
  /** Longitud máxima (texto). Mapea a `Validators.maxLength` y a `maxlength` HTML. */
  maxLength?: number;
  /** Valor mínimo (número/currency). */
  min?: number;
  /** Valor máximo (número/currency). */
  max?: number;
  /** Patrón regex (texto). */
  pattern?: string | RegExp;
  /**
   * Mensajes de error personalizados por tipo de validador.
   * Si no se especifica, se usa un mensaje genérico.
   * Ej: { required: 'El nombre es obligatorio', pattern: 'Solo letras y espacios' }
   */
  errorMessages?: Partial<Record<
    'required' | 'email' | 'minlength' | 'maxlength' | 'min' | 'max' | 'pattern',
    string
  >>;
  /** Texto de ayuda mostrado bajo el campo (no es un error, es una pista). */
  hint?: string;

  /** Fecha: deshabilitar días anteriores al inicio de hoy (hora local). */
  disableDatesBeforeToday?: boolean;
  /**
   * Si `disableDatesBeforeToday` está activo: en `createOnly` la regla solo aplica al crear
   * (útil para la fecha de compra al editar valeras antiguas).
   */
  minTodayMode?: 'always' | 'createOnly';
  /** Fecha: no permitir selector anterior al valor de otro control de fecha (mismo día permitido). */
  notBeforeField?: string;
}

export interface FormModalData {
  fields: FormField[];
  initialValue?: Record<string, any>;
  mode?: 'create' | 'edit';
}

@Component({
  selector: 'app-form-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzSwitchModule,
    NzButtonModule,
    NzIconModule,
    NzInputNumberModule,
    NzDatePickerModule
  ],
  templateUrl: './form-modal.component.html',
  styleUrl: './form-modal.component.css'
})
export class FormModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private modalRef = inject(NzModalRef);
  data: FormModalData = inject(NZ_MODAL_DATA);

  form!: FormGroup;
  loading = false;
  fieldRows: FormField[][] = [];
  /** Campos realmente visibles según el modo (create/edit). */
  private visibleFields: FormField[] = [];
  /** Texto mostrado en inputs COP (miles es-CO al teclear). */
  private currencyText: Record<string, string> = {};

  ngOnInit(): void {
    this.visibleFields = this.filterByMode(this.data.fields);
    const controls: Record<string, any> = {};

    for (const field of this.visibleFields) {
      const validators = [];

      if (field.required) validators.push(Validators.required);
      if (field.type === 'email') validators.push(Validators.email);
      if (field.minLength != null) validators.push(Validators.minLength(field.minLength));
      if (field.maxLength != null) validators.push(Validators.maxLength(field.maxLength));
      if (field.min != null) validators.push(Validators.min(field.min));
      if (field.max != null) validators.push(Validators.max(field.max));
      if (field.pattern != null) {
        const p = field.pattern instanceof RegExp ? field.pattern : new RegExp(field.pattern);
        validators.push(Validators.pattern(p));
      }

      const rawInitial = this.data.initialValue?.[field.key];
      let initial: any;
      if (field.type === 'switch') {
        initial = rawInitial ?? false;
      } else if ((field.type === 'date' || field.type === 'datetime') && rawInitial) {
        // Los date pickers requieren un Date; el backend manda ISO string.
        const parsed = new Date(rawInitial);
        initial = isNaN(parsed.getTime()) ? null : parsed;
      } else if (field.type === 'currency') {
        if (rawInitial == null || rawInitial === '') {
          initial = null;
        } else {
          const n = typeof rawInitial === 'number' ? rawInitial : Number(rawInitial);
          initial = Number.isNaN(n) ? null : n;
        }
      } else {
        initial = rawInitial ?? (field.type === 'date' || field.type === 'datetime' ? null : '');
      }

      controls[field.key] = [initial, validators];
    }

    this.form = this.fb.group(controls);
    this.initCurrencyDisplays();
    this.fieldRows = this.computeFieldRows();
  }

  private initCurrencyDisplays(): void {
    for (const f of this.visibleFields) {
      if (f.type !== 'currency') continue;
      const c = this.form.get(f.key);
      const v = c?.value;
      if (v == null || v === '' || (typeof v === 'number' && isNaN(v))) {
        this.currencyText[f.key] = '';
      } else {
        this.currencyText[f.key] = this.formatCop(Number(v));
      }
    }
  }

  /** Salida en vivo es-CO: `$ 1.000.000` (sin decimales, COP entero). */
  formatCop(n: number | null | undefined): string {
    if (n == null || (typeof n === 'number' && isNaN(n))) return '';
    return (
      '$ ' +
      Math.round(Number(n)).toLocaleString('es-CO', {
        maximumFractionDigits: 0,
        minimumFractionDigits: 0
      })
    );
  }

  currencyDisplayValue(key: string): string {
    return this.currencyText[key] ?? '';
  }

  onCurrencyInput(key: string, e: Event): void {
    const input = e.target as HTMLInputElement;
    const c = this.form.get(key);
    if (!c) return;

    const digits = (input.value ?? '').replace(/\D/g, '');
    if (digits === '') {
      c.setValue(null, { emitEvent: true });
      this.currencyText[key] = '';
    } else {
      if (digits.length > 15) return;
      const n = parseInt(digits, 10);
      if (Number.isNaN(n) || n < 0) return;
      c.setValue(n, { emitEvent: true });
      this.currencyText[key] = this.formatCop(n);
    }
    c.markAsDirty();
    c.updateValueAndValidity();
  }

  onCurrencyFocus(e: Event): void {
    const el = e.target as HTMLInputElement;
    requestAnimationFrame(() => el?.select());
  }

  /**
   * Devuelve el primer mensaje de error visible para un campo, o null si no hay.
   * Usa errorMessages personalizados del field o un mensaje genérico.
   */
  getError(field: FormField): string | null {
    const ctrl = this.form?.get(field.key);
    if (!ctrl || !ctrl.errors || (!ctrl.dirty && !ctrl.touched)) return null;

    const errors = ctrl.errors;
    const msgs = field.errorMessages ?? {};

    if (errors['required']) return msgs.required ?? `${field.label} es obligatorio.`;
    if (errors['email'])    return msgs.email    ?? 'Formato de email no válido.';
    if (errors['minlength']) return msgs.minlength
      ?? `Debe tener al menos ${errors['minlength'].requiredLength} caracteres.`;
    if (errors['maxlength']) return msgs.maxlength
      ?? `No puede superar ${errors['maxlength'].requiredLength} caracteres.`;
    if (errors['min']) return msgs.min ?? `El valor mínimo es ${errors['min'].min}.`;
    if (errors['max']) return msgs.max ?? `El valor máximo es ${errors['max'].max}.`;
    if (errors['pattern']) return msgs.pattern ?? 'El formato no es válido.';
    return 'Valor inválido.';
  }

  /** Filtra los campos según el modo del modal (create/edit). 'both' siempre se incluye. */
  private filterByMode(fields: FormField[]): FormField[] {
    const mode = this.data.mode ?? 'create';
    return fields.filter(f => !f.mode || f.mode === 'both' || f.mode === mode);
  }

  private computeFieldRows(): FormField[][] {
    const rows: FormField[][] = [];
    let currentRow: FormField[] = [];
    let currentSpan = 0;

    for (const field of this.visibleFields) {
      const span = field.span || 24;
      if (currentSpan + span > 24) {
        rows.push(currentRow);
        currentRow = [];
        currentSpan = 0;
      }
      currentRow.push(field);
      currentSpan += span;
    }
    if (currentRow.length) rows.push(currentRow);

    return rows;
  }

  trackByField(_: number, field: FormField): string {
    return field.key;
  }

  trackByRow(index: number): number {
    return index;
  }

  /** Devuelve disabledDate para nz-date-picker (hoy mínimo, no antes de otro campo). */
  getDisabledDateFor(field: FormField): (d: Date) => boolean {
    const useMinToday =
      field.disableDatesBeforeToday &&
      (field.minTodayMode !== 'createOnly' || (this.data.mode ?? 'create') === 'create');
    const otherKey = field.notBeforeField;

    if (!useMinToday && !otherKey) return () => false;

    return (current: Date): boolean => {
      if (!current) return false;
      const cur = this.startOfLocalDay(current);

      if (useMinToday) {
        const today = this.startOfLocalDay(new Date());
        if (cur < today) return true;
      }

      if (otherKey) {
        const otherVal = this.form?.get(otherKey)?.value as Date | string | null | undefined;
        if (otherVal) {
          const o = this.startOfLocalDay(
            otherVal instanceof Date ? otherVal : new Date(otherVal),
          );
          if (!isNaN(o) && cur < o) return true;
        }
      }

      return false;
    };
  }

  private startOfLocalDay(d: Date): number {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }

  cancel(): void {
    this.modalRef.close();
  }

  submit(): void {
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach(c => {
        c.markAsDirty();
        c.updateValueAndValidity();
      });
      return;
    }

    // Normalizar fechas a ISO string para el backend (los pickers devuelven Date).
    const value = { ...this.form.value };
    for (const field of this.visibleFields) {
      if ((field.type === 'date' || field.type === 'datetime') && value[field.key] instanceof Date) {
        value[field.key] = (value[field.key] as Date).toISOString();
      }
    }
    this.modalRef.close(value);
  }

  getErrorTip(field: FormField): string {
    const control = this.form.get(field.key);
    if (control?.hasError('required')) return `${field.label} es requerido`;
    if (control?.hasError('email')) return 'Email inválido';
    return '';
  }
}
