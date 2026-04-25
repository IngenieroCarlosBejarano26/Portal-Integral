/**
 * Construye el cuerpo HTML del correo "menú del día" a partir de textos en claro
 * (sin que el usuario escriba HTML) y embebe metadatos para poder volver a abrir
 * el formulario simple. Los placeholders de sistema ({{NombreCliente}}, fechas) se
 * dejan en el HTML para que el backend los reemplace.
 */

export interface MenuDiaSimple {
  entrada: string;
  platoFuerte: string;
  bebida: string;
  nota: string;
}

const META_PREFIX = 'valeras-menudia:';
const META_REGEX = new RegExp(
  `<!--\\s*${META_PREFIX}([A-Za-z0-9+/=\\s]+?)\\s*-->`,
  's'
);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toBase64Utf8(json: string): string {
  return btoa(unescape(encodeURIComponent(json)));
}

function fromBase64Utf8(b64: string): string {
  return decodeURIComponent(escape(atob(b64.trim().replace(/\s/g, ''))));
}

/** Genera un HTML con estilos de correo y bloque de metadatos (round-trip al editor simple). */
export function buildMenuDiaCuerpoHtml(f: MenuDiaSimple): string {
  const v = 1;
  const payload = JSON.stringify({
    v,
    e: f.entrada,
    p: f.platoFuerte,
    b: f.bebida,
    n: f.nota
  });
  const meta = `<!--${META_PREFIX}${toBase64Utf8(payload)}-->`;

  const row = (label: string, value: string) => {
    const t = (value || '').trim() || '—';
    return `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;width:32%;vertical-align:top;">${label}</td>
      <td style="padding:10px 0;border-bottom:1px solid #E5E7EB;vertical-align:top;">${escapeHtml(t)}</td>
    </tr>`;
  };

  const notaBlock =
    f.nota.trim().length > 0
      ? `<p style="margin:16px 0 0;font-size:14px;color:#374151;"><strong>Nota:</strong> ${escapeHtml(f.nota.trim())}</p>`
      : '';

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;background:#F0FDF4;color:#14532D;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#FFFFFF;border:1px solid #D1FAE5;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(5,150,105,0.12);">
          <tr>
            <td style="background:linear-gradient(125deg,#059669 0%,#10b981 50%,#34d399 100%);padding:26px 28px;color:#fff;">
              <p style="margin:0 0 4px;font-size:13px;opacity:0.95;">{{FechaHoyLarga}}</p>
              <h1 style="margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Menú del día</h1>
              <p style="margin:8px 0 0;font-size:14px;opacity:0.95;">Fecha: {{FechaHoy}} (Colombia)</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 26px 24px;color:#1f2937;">
              <p style="margin:0 0 18px;font-size:16px;">Hola <strong style="color:#047857;">{{NombreCliente}}</strong>,</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">Compartimos nuestro <strong>menú de hoy</strong>:</p>
              <table role="presentation" width="100%" style="font-size:15px;border-collapse:collapse;">
                ${row('Entrada', f.entrada)}
                ${row('Plato fuerte', f.platoFuerte)}
                <tr>
                  <td style="padding:10px 0;color:#6B7280;vertical-align:top;">Bebida</td>
                  <td style="padding:10px 0;vertical-align:top;">${escapeHtml(
                    f.bebida.trim() || '—'
                  )}</td>
                </tr>
              </table>
              ${notaBlock}
              <p style="margin:22px 0 0;font-size:15px;font-weight:600;color:#047857;">¡Te esperamos!</p>
              <p style="margin:20px 0 0;font-size:12px;color:#9CA3AF;">Mensaje automático. Por favor no respondas a este correo.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  ${meta}
</body>
</html>`;
}

/**
 * Recupera los campos del formulario si el HTML fue generado con buildMenuDiaCuerpoHtml
 * o actualizado guardando un bloque con el mismo comentario.
 */
export function parseMenuDiaCuerpoHtml(html: string | null | undefined): MenuDiaSimple | null {
  if (!html || !html.trim()) return null;
  const m = html.match(META_REGEX);
  if (!m) return null;
  try {
    const raw = fromBase64Utf8(m[1]);
    const o = JSON.parse(raw) as { v?: number; e?: string; p?: string; b?: string; n?: string };
    if (o == null || typeof o !== 'object') return null;
    return {
      entrada: o.e ?? '',
      platoFuerte: o.p ?? '',
      bebida: o.b ?? '',
      nota: o.n ?? ''
    };
  } catch {
    return null;
  }
}

export function defaultMenuDiaVacio(): MenuDiaSimple {
  return { entrada: '', platoFuerte: '', bebida: '', nota: '' };
}
