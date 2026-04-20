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
      } else {
        initial = rawInitial ?? (field.type === 'date' || field.type === 'datetime' ? null : '');
      }

      controls[field.key] = [initial, validators];
    }

    this.form = this.fb.group(controls);
    this.fieldRows = this.computeFieldRows();
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

  /** Formatea un número como pesos colombianos (sin decimales). */
  readonly currencyFormatter = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value as number)) return '';
    return '$ ' + Number(value).toLocaleString('es-CO');
  };

  /** Quita el formato de moneda y devuelve el número plano para el FormControl. */
  readonly currencyParser = (value: string): number => {
    const digits = (value || '').replace(/[^\d]/g, '');
    return digits ? Number(digits) : 0;
  };

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
