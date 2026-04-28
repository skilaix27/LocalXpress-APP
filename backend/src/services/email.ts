import { Resend } from 'resend';
import { config } from '../config';
import type { Stop } from '../types';

const FALLBACK_NOTIFICATION_EMAIL = 'robertogarcia2772@gmail.com';

function getResendClient(): Resend | null {
  if (!config.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY no configurado — notificaciones desactivadas');
    return null;
  }
  return new Resend(config.RESEND_API_KEY);
}

function formatDatetime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return 'Sin fecha programada';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export async function sendNewStopNotification(stop: Stop): Promise<void> {
  const resend = getResendClient();
  if (!resend) return;

  const to = config.NOTIFICATION_EMAIL ?? FALLBACK_NOTIFICATION_EMAIL;
  const from = config.RESEND_FROM ?? 'LocalXpress <noreply@localxpress.app>';

  const shopName = stop.shop_name ?? 'Cliente';
  const orderCode = stop.order_code ?? stop.id;
  const scheduled = formatDatetime(stop.scheduled_pickup_at);

  const subject = `Nuevo pedido ${orderCode} — ${shopName}`;

  const textBody = [
    `Nueva parada solicitada por ${shopName}.`,
    '',
    `Código: ${orderCode}`,
    `Servicio programado para: ${scheduled}`,
    `Recogida: ${stop.pickup_address}`,
    `Entrega: ${stop.delivery_address}`,
    `Cliente: ${stop.client_name}`,
    stop.client_phone ? `Teléfono: ${stop.client_phone}` : null,
    stop.client_notes ? `Notas: ${stop.client_notes}` : null,
  ].filter(Boolean).join('\n');

  const htmlBody = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
  <div style="background:#f4f4f5;border-radius:8px;padding:16px 20px;margin-bottom:24px">
    <h1 style="margin:0;font-size:18px;color:#1a1a1a">🚀 Nuevo pedido recibido</h1>
    <p style="margin:4px 0 0;color:#71717a;font-size:14px">Solicitado por <strong>${shopName}</strong></p>
  </div>

  <table style="width:100%;border-collapse:collapse">
    <tr>
      <td style="padding:8px 0;color:#71717a;font-size:13px;width:160px;vertical-align:top">Código</td>
      <td style="padding:8px 0;font-weight:600;font-size:15px">${orderCode}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;color:#71717a;font-size:13px;vertical-align:top">Fecha programada</td>
      <td style="padding:8px 0">${scheduled}</td>
    </tr>
    <tr style="border-top:1px solid #e4e4e7">
      <td style="padding:8px 0;color:#71717a;font-size:13px;vertical-align:top">Recogida</td>
      <td style="padding:8px 0">${stop.pickup_address}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;color:#71717a;font-size:13px;vertical-align:top">Entrega</td>
      <td style="padding:8px 0">${stop.delivery_address}</td>
    </tr>
    <tr style="border-top:1px solid #e4e4e7">
      <td style="padding:8px 0;color:#71717a;font-size:13px;vertical-align:top">Cliente</td>
      <td style="padding:8px 0">${stop.client_name}</td>
    </tr>
    ${stop.client_phone ? `
    <tr>
      <td style="padding:8px 0;color:#71717a;font-size:13px;vertical-align:top">Teléfono</td>
      <td style="padding:8px 0"><a href="tel:${stop.client_phone}" style="color:#2563eb">${stop.client_phone}</a></td>
    </tr>` : ''}
    ${stop.client_notes ? `
    <tr>
      <td style="padding:8px 0;color:#71717a;font-size:13px;vertical-align:top">Notas</td>
      <td style="padding:8px 0;font-style:italic;color:#52525b">${stop.client_notes}</td>
    </tr>` : ''}
  </table>

  <p style="margin-top:32px;font-size:12px;color:#a1a1aa;border-top:1px solid #e4e4e7;padding-top:16px">
    LocalXpress · Gestión logística de última milla
  </p>
</body>
</html>`;

  await resend.emails.send({ from, to, subject, text: textBody, html: htmlBody });
  console.log(`[email] Notificación enviada a ${to} para pedido ${orderCode}`);
}
