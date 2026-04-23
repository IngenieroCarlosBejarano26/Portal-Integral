import { Pipe, PipeTransform, inject } from '@angular/core';
import { CurrencyService } from '../../core/services/currency/currency.service';

/**
 * Formatea un precio USD mostrando ambas monedas: "USD $50 - COP $200.000".
 *
 * Uso en templates:
 * ```html
 * {{ plan.precioMensualUSD | usdCop }}
 * ```
 *
 * Modos:
 * - `'full'` (default): "USD $50 / mes (~COP $200.000)"
 * - `'cop-only'`:       "COP $200.000 / mes"
 * - `'short'`:          "$50 USD / $200.000 COP"
 *
 * Es un pipe `pure: false` para reactivar cuando cambia la tasa cacheada.
 */
@Pipe({
  name: 'usdCop',
  standalone: true,
  pure: false
})
export class UsdCopPipe implements PipeTransform {
  private currency = inject(CurrencyService);

  transform(usd: number | null | undefined, mode: 'full' | 'cop-only' | 'short' = 'full'): string {
    if (usd == null || isNaN(usd)) return '';
    const cop = this.currency.toCop(usd);
    const usdStr = `USD $${usd.toFixed(usd % 1 === 0 ? 0 : 2)}`;
    const copStr = `COP $${this.formatCop(cop)}`;

    switch (mode) {
      case 'cop-only': return `${copStr} / mes`;
      case 'short':    return `$${usd} USD / $${this.formatCop(cop)} COP`;
      default:         return `${usdStr} / mes (~${copStr})`;
    }
  }

  /** Formato colombiano: 200000 -> "200.000" */
  private formatCop(value: number): string {
    return Math.round(value).toLocaleString('es-CO');
  }
}
