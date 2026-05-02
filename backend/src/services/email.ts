import fs from 'fs';
import path from 'path';
import { Resend } from 'resend';
import sharp from 'sharp';
import { config } from '../config';
import type { Stop } from '../types';

// Photo limits for email attachment
const ORIGINAL_MAX_BYTES   = 8 * 1024 * 1024;  // 8 MB — skip if original is heavier
const COMPRESSED_MAX_BYTES = 1 * 1024 * 1024;  // 1 MB — skip compressed if still too heavy
const ALLOWED_EXTENSIONS   = new Set(['.jpg', '.jpeg', '.png', '.webp']);

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

// ─── Individual order: delivery notification to customer ──────────────────────

function isIndividualOrder(stop: Stop): boolean {
  return (
    stop.order_type === 'individual' ||
    stop.source === 'individual_web' ||
    (stop.order_code?.startsWith('LXP-') ?? false)
  );
}

function resolveProofPhotoPath(proofUrl: string | null): string | null {
  if (!proofUrl) return null;
  // proofUrl can be /uploads/proofs/file.jpg or proofs/file.jpg
  const relative = proofUrl.replace(/^\/uploads\//, '');
  const storageDir = path.resolve(config.STORAGE_DIR);
  return path.resolve(storageDir, relative);
}

// Compress proof photo into a Buffer suitable for email attachment.
// Returns null if the photo cannot or should not be attached.
async function compressProofPhoto(
  orderCode: string,
  proofUrl: string | null,
): Promise<{ filename: string; content: Buffer; contentType: string } | null> {
  const photoPath = resolveProofPhotoPath(proofUrl);
  if (!photoPath) return null;

  const ext = path.extname(photoPath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    console.warn(`[email] Delivery photo skipped for ${orderCode} reason=unsupported format ext=${ext}`);
    return null;
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(photoPath);
  } catch {
    console.warn(`[email] Delivery photo not found for ${orderCode}, sending without attachment`);
    return null;
  }

  if (stat.size > ORIGINAL_MAX_BYTES) {
    console.warn(`[email] Delivery photo skipped for ${orderCode} reason=original file too large size=${(stat.size / 1024 / 1024).toFixed(1)}MB`);
    return null;
  }

  console.log(`[email] Compressing delivery photo for ${orderCode}`);

  let compressed: Buffer;
  try {
    compressed = await sharp(photoPath)
      .rotate()                                                       // auto-rotate from EXIF
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 68, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    console.warn(`[email] Delivery photo compression failed for ${orderCode}: ${String(err)}, sending without attachment`);
    return null;
  }

  const originalKB   = Math.round(stat.size / 1024);
  const compressedKB = Math.round(compressed.length / 1024);
  console.log(`[email] Delivery photo compressed for ${orderCode} original=${originalKB}KB compressed=${compressedKB}KB`);

  if (compressed.length > COMPRESSED_MAX_BYTES) {
    console.warn(`[email] Delivery photo skipped for ${orderCode} reason=compressed file too large size=${compressedKB}KB`);
    return null;
  }

  console.log(`[email] Delivery photo attached for ${orderCode}`);
  return {
    filename: `comprobante-entrega-${orderCode}.jpg`,
    content: compressed,
    contentType: 'image/jpeg',
  };
}

export async function sendIndividualDeliveryNotification(stop: Stop): Promise<void> {
  const orderCode = stop.order_code ?? stop.id;

  if (!isIndividualOrder(stop)) {
    console.log(`[email] Delivery notification skipped for ${orderCode} reason=not individual`);
    return;
  }

  const to = stop.customer_email;
  if (!to || !to.includes('@')) {
    console.log(`[email] Delivery notification skipped for ${orderCode} reason=no customer_email`);
    return;
  }

  if (stop.delivery_notified_at) {
    console.log(`[email] Delivery notification skipped for ${orderCode} reason=already notified`);
    return;
  }

  const resend = getResendClient();
  if (!resend) return;

  const from = config.RESEND_FROM ?? 'LocalXpress <noreply@localxpress.app>';
  const deliveredAt = stop.delivered_at ? formatDatetime(stop.delivered_at) : 'ahora';

  const subject = `Tu pedido LocalXpress ${orderCode} ha sido entregado`;

  // ── Compress proof photo before building email ─────────────────────────────
  type Attachment = { filename: string; content: Buffer; contentType: string };
  const attachment = await compressProofPhoto(orderCode, stop.proof_photo_url);

  const hasPhoto = attachment !== null;

  const textBody = [
    `Hola,`,
    ``,
    `Tu pedido ${orderCode} ha sido entregado correctamente.`,
    ``,
    `Fecha de entrega: ${deliveredAt}`,
    `Dirección de entrega: ${stop.delivery_address}`,
    hasPhoto ? `` : ``,
    `Gracias por confiar en LocalXpress.`,
  ].filter((l) => l !== undefined).join('\n');

  const htmlBody = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
  <div style="background:#dcfce7;border-radius:8px;padding:16px 20px;margin-bottom:24px">
    <h1 style="margin:0;font-size:20px;color:#15803d">✅ Pedido entregado</h1>
    <p style="margin:4px 0 0;color:#166534;font-size:14px">Tu envío ha llegado a su destino</p>
  </div>

  <table style="width:100%;border-collapse:collapse">
    <tr>
      <td style="padding:8px 0;color:#71717a;font-size:13px;width:160px;vertical-align:top">Código de pedido</td>
      <td style="padding:8px 0;font-weight:600;font-size:15px">${orderCode}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;color:#71717a;font-size:13px;vertical-align:top">Entregado el</td>
      <td style="padding:8px 0">${deliveredAt}</td>
    </tr>
    <tr style="border-top:1px solid #e4e4e7">
      <td style="padding:8px 0;color:#71717a;font-size:13px;vertical-align:top">Dirección de entrega</td>
      <td style="padding:8px 0">${stop.delivery_address}</td>
    </tr>
  </table>

  ${hasPhoto
    ? `<p style="margin-top:20px;font-size:13px;color:#52525b">Adjuntamos el comprobante de entrega.</p>`
    : ''}

  <p style="margin-top:${hasPhoto ? '12' : '28'}px;font-size:14px;color:#52525b">
    Gracias por confiar en <strong>LocalXpress</strong>.
  </p>

  <p style="margin-top:32px;font-size:12px;color:#a1a1aa;border-top:1px solid #e4e4e7;padding-top:16px">
    LocalXpress · Gestión logística de última milla en Barcelona
  </p>
</body>
</html>`;

  const attachments: Attachment[] | undefined = attachment ? [attachment] : undefined;

  console.log(`[email] Delivery notification queued for ${orderCode}`);
  await resend.emails.send({ from, to, subject, text: textBody, html: htmlBody, attachments });
  console.log(`[email] Delivery notification sent to ${to} for ${orderCode}`);
}
