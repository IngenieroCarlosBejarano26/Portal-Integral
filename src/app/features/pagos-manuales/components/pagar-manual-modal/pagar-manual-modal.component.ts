import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzModalRef, NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { PagoManualService, InfoPagoPublica, MetodoPago } from '../../services/pago-manual.service';
import { CurrencyService } from '../../../../core/services/currency/currency.service';
import { PlanCatalogo } from '../../../planes/services/plan.service';

interface ModalData { plan: PlanCatalogo; }

@Component({
  selector: 'app-pagar-manual-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NzButtonModule, NzIconModule, NzInputModule, NzSelectModule, NzAlertModule],
  templateUrl: './pagar-manual-modal.component.html',
  styleUrl: './pagar-manual-modal.component.css'
})
export class PagarManualModalComponent implements OnInit {
  private data: ModalData = inject(NZ_MODAL_DATA);
  plan: PlanCatalogo = this.data.plan;

  private pagoService = inject(PagoManualService);
  private currency = inject(CurrencyService);
  private modalRef = inject(NzModalRef);
  private notification = inject(NzNotificationService);

  info: InfoPagoPublica | null = null;
  metodoPago: MetodoPago = 'Nequi';
  referenciaPago = '';
  notas = '';
  comprobanteBase64: string | null = null;
  comprobanteFileName: string | null = null;
  comprobanteContentType: string | null = null;
  enviando = false;
  cargando = true;

  ngOnInit(): void {
    this.pagoService.obtenerInfoPago().subscribe({
      next: (info) => { this.info = info; this.cargando = false; },
      error: () => { this.cargando = false; this.notification.error('Error', 'No se pudieron cargar los datos de pago.'); }
    });
  }

  get montoCOP(): number {
    return Math.round(this.currency.toCop(this.plan.precioMensualUSD));
  }

  get montoCOPFormateado(): string {
    return this.montoCOP.toLocaleString('es-CO');
  }

  get qrNequiUrl(): string {
    // QR generado desde la API gratuita de qrserver. Codifica el numero Nequi.
    const numeroLimpio = (this.info?.nequiNumero ?? '').replace(/\s+/g, '');
    if (!numeroLimpio) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(numeroLimpio)}`;
  }

  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      this.notification.warning('Archivo muy grande', 'El comprobante no debe superar 5 MB.');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result viene como "data:image/png;base64,XXXX"; extraemos solo el base64
      const base64 = result.split(',')[1];
      this.comprobanteBase64 = base64;
      this.comprobanteFileName = file.name;
      this.comprobanteContentType = file.type;
    };
    reader.readAsDataURL(file);
  }

  copiarAlPortapapeles(texto: string, etiqueta: string): void {
    navigator.clipboard.writeText(texto).then(
      () => this.notification.success('Copiado', `${etiqueta} copiado al portapapeles.`),
      () => this.notification.error('Error', 'No se pudo copiar.')
    );
  }

  enviar(): void {
    if (!this.referenciaPago.trim()) {
      this.notification.warning('Referencia requerida', 'Ingresa la referencia/numero de transaccion.');
      return;
    }

    this.enviando = true;
    this.pagoService.solicitar({
      planSolicitadoId: this.plan.planId,
      precioUSD: this.plan.precioMensualUSD,
      montoCOP: this.montoCOP,
      tasaCambio: this.currency.getRate(),
      metodoPago: this.metodoPago,
      referenciaPago: this.referenciaPago.trim(),
      notas: this.notas?.trim() || undefined,
      comprobanteBase64: this.comprobanteBase64 ?? undefined,
      comprobanteFileName: this.comprobanteFileName ?? undefined,
      comprobanteContentType: this.comprobanteContentType ?? undefined
    }).subscribe({
      next: (res) => {
        this.enviando = false;
        if (res.success) {
          this.notification.success('Solicitud enviada',
            res.message ?? 'Te avisaremos cuando sea aprobada.');
          this.modalRef.close(true);
        } else {
          this.notification.error('Error', res.message ?? 'No se pudo enviar.');
        }
      },
      error: (err) => {
        this.enviando = false;
        this.notification.error('Error', err?.error?.message ?? 'No se pudo enviar.');
      }
    });
  }

  cancelar(): void {
    this.modalRef.close(false);
  }
}
