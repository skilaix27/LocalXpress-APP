import fs from 'fs';
import path from 'path';
import { Resend } from 'resend';
import sharp from 'sharp';
import { config } from '../config';
import { queryOne } from '../db';
import type { Stop } from '../types';

// ─── Photo compression limits ─────────────────────────────────────────────────
const ORIGINAL_MAX_BYTES   = 8 * 1024 * 1024;
const COMPRESSED_MAX_BYTES = 1 * 1024 * 1024;
const ALLOWED_PHOTO_EXTS   = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const FALLBACK_NOTIFICATION_EMAIL = 'robertogarcia2772@gmail.com';

// ─── Resend client ────────────────────────────────────────────────────────────

function getResendClient(): Resend | null {
  if (!config.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY no configurado — notificaciones desactivadas');
    return null;
  }
  return new Resend(config.RESEND_API_KEY);
}

// ─── Shared formatting helpers ────────────────────────────────────────────────

export function formatEmailDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return 'Sin fecha programada';
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatMoney(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return `${amount.toFixed(2)} €`;
}

export function getOrderTypeLabel(stop: Stop): string {
  if (
    stop.order_type === 'individual' ||
    stop.source === 'individual_web' ||
    (stop.order_code?.startsWith('LXP-') ?? false)
  ) return 'Particular';
  return 'Empresa';
}

function isIndividualOrder(stop: Stop): boolean {
  return getOrderTypeLabel(stop) === 'Particular';
}

// ─── Shared email footer ──────────────────────────────────────────────────────

function getSupportFooterHtml(): string {
  return `
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
  <p style="font-size:12px;line-height:18px;color:#6b7280;margin:0 0 10px;">
    Si tienes cualquier incidencia, duda o problema relacionado con este servicio,
    puedes contactar con nuestro equipo de soporte escribiendo a
    <a href="mailto:incidencias@localxpress.es" style="color:#f97316;text-decoration:none;font-weight:500;">incidencias@localxpress.es</a>
    o llamando al
    <a href="tel:+34711225793" style="color:#f97316;text-decoration:none;font-weight:500;">+34 711 22 57 93</a>.
  </p>
  <p style="font-size:11px;line-height:16px;color:#9ca3af;margin:0;">
    LocalXpress · Gestión logística de última milla en Barcelona
  </p>`;
}

function getSupportFooterText(): string {
  return [
    '',
    '---',
    'Si tienes cualquier incidencia, duda o problema relacionado con este servicio,',
    'puedes contactar con nuestro equipo de soporte escribiendo a incidencias@localxpress.es',
    'o llamando al +34 711 22 57 93.',
    '',
    'LocalXpress · Gestión logística de última milla en Barcelona',
  ].join('\n');
}

function getInternalFooterHtml(): string {
  return `
  <p style="margin-top:28px;font-size:11px;line-height:16px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:14px;">
    LocalXpress · Gestión logística de última milla en Barcelona
  </p>`;
}

// ─── Base HTML email builder ──────────────────────────────────────────────────

interface EmailRow { label: string; value: string; bold?: boolean }

interface BaseEmailOptions {
  headerBg: string;
  headerTitleColor: string;
  headerBodyColor: string;
  headerEmoji: string;
  headerTitle: string;
  headerSubtitle: string;
  rows: EmailRow[];
  extraHtml?: string;
  footerHtml: string;
}

function buildEmailHtml(opts: BaseEmailOptions): string {
  const rowsHtml = opts.rows.map((r, i) => `
    <tr${i > 0 ? ' style="border-top:1px solid #f3f4f6;"' : ''}>
      <td style="padding:9px 0;color:#6b7280;font-size:13px;width:170px;vertical-align:top;white-space:nowrap;">${r.label}</td>
      <td style="padding:9px 0;font-size:14px;${r.bold ? 'font-weight:600;' : 'color:#374151;'}">${r.value}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,0.08);overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:${opts.headerBg};padding:22px 28px;">
            <p style="margin:0;font-size:24px;">${opts.headerEmoji}</p>
            <h1 style="margin:6px 0 4px;font-size:20px;font-weight:700;color:${opts.headerTitleColor};line-height:1.2;">${opts.headerTitle}</h1>
            <p style="margin:0;font-size:14px;color:${opts.headerBodyColor};">${opts.headerSubtitle}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:24px 28px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${rowsHtml}
            </table>
            ${opts.extraHtml ?? ''}
            ${opts.footerHtml}
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Photo compression ────────────────────────────────────────────────────────

function resolveProofPhotoPath(proofUrl: string | null): string | null {
  if (!proofUrl) return null;
  const relative = proofUrl.replace(/^\/uploads\//, '');
  return path.resolve(config.STORAGE_DIR, relative);
}

type PhotoAttachment = { filename: string; content: Buffer; contentType: string };

async function compressProofPhoto(orderCode: string, proofUrl: string | null): Promise<PhotoAttachment | null> {
  const photoPath = resolveProofPhotoPath(proofUrl);
  if (!photoPath) return null;

  const ext = path.extname(photoPath).toLowerCase();
  if (!ALLOWED_PHOTO_EXTS.has(ext)) {
    console.warn(`[email] Delivery photo skipped for ${orderCode} reason=unsupported format ext=${ext}`);
    return null;
  }

  let stat: fs.Stats;
  try { stat = fs.statSync(photoPath); }
  catch {
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
      .rotate()
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 68, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    console.warn(`[email] Delivery photo compression failed for ${orderCode}: ${String(err)}, sending without attachment`);
    return null;
  }

  const origKB = Math.round(stat.size / 1024);
  const compKB = Math.round(compressed.length / 1024);
  console.log(`[email] Delivery photo compressed for ${orderCode} original=${origKB}KB compressed=${compKB}KB`);

  if (compressed.length > COMPRESSED_MAX_BYTES) {
    console.warn(`[email] Delivery photo skipped for ${orderCode} reason=compressed file too large size=${compKB}KB`);
    return null;
  }

  console.log(`[email] Delivery photo attached for ${orderCode}`);
  return { filename: `comprobante-entrega-${orderCode}.jpg`, content: compressed, contentType: 'image/jpeg' };
}

// ─── Email 1: Internal — new stop created (→ NOTIFICATION_EMAIL) ─────────────

export async function sendNewStopNotification(stop: Stop): Promise<void> {
  const resend = getResendClient();
  if (!resend) return;

  const to        = config.NOTIFICATION_EMAIL ?? FALLBACK_NOTIFICATION_EMAIL;
  const from      = config.RESEND_FROM ?? 'LocalXpress <noreply@localxpress.app>';
  const orderCode = stop.order_code ?? stop.id;
  const typeLabel = getOrderTypeLabel(stop);
  const isPaid    = stop.payment_status === 'paid';
  const solicitadoPor = stop.shop_name ?? stop.customer_full_name ?? stop.client_name ?? stop.source ?? '—';

  const subject = typeLabel === 'Particular'
    ? `Nuevo pedido particular${isPaid ? ' pagado' : ''} · ${orderCode}`
    : `Nuevo pedido de empresa · ${orderCode}`;

  const rows: EmailRow[] = [
    { label: 'Tipo de pedido', value: typeLabel, bold: true },
    { label: 'Código', value: orderCode, bold: true },
    { label: 'Solicitado por', value: solicitadoPor },
    { label: 'Fecha del servicio', value: formatEmailDate(stop.scheduled_pickup_at) },
    { label: 'Recogida', value: stop.pickup_address },
    { label: 'Entrega', value: stop.delivery_address },
    { label: 'Cliente final', value: stop.client_name },
    ...(stop.client_phone ? [{ label: 'Teléfono cliente', value: stop.client_phone }] : []),
    { label: 'Precio', value: formatMoney(stop.price) },
    { label: 'Estado pago', value: isPaid ? 'Pagado ✓' : (stop.payment_status ?? 'Pendiente') },
  ];

  const textLines = [
    subject,
    '',
    `Tipo:            ${typeLabel}`,
    `Código:          ${orderCode}`,
    `Solicitado por:  ${solicitadoPor}`,
    `Fecha servicio:  ${formatEmailDate(stop.scheduled_pickup_at)}`,
    `Recogida:        ${stop.pickup_address}`,
    `Entrega:         ${stop.delivery_address}`,
    `Cliente:         ${stop.client_name}`,
    stop.client_phone ? `Teléfono:        ${stop.client_phone}` : null,
    `Precio:          ${formatMoney(stop.price)}`,
    `Pago:            ${isPaid ? 'Pagado' : (stop.payment_status ?? 'Pendiente')}`,
    '',
    'LocalXpress · Gestión logística de última milla en Barcelona',
  ].filter((l): l is string => l !== null).join('\n');

  const html = buildEmailHtml({
    headerBg: typeLabel === 'Particular' ? '#eff6ff' : '#f4f4f5',
    headerTitleColor: typeLabel === 'Particular' ? '#1e40af' : '#1a1a1a',
    headerBodyColor: typeLabel === 'Particular' ? '#3b82f6' : '#71717a',
    headerEmoji: '🚀',
    headerTitle: subject,
    headerSubtitle: `Solicitado por ${solicitadoPor}`,
    rows,
    footerHtml: getInternalFooterHtml(),
  });

  await resend.emails.send({ from, to, subject, text: textLines, html });
  console.log(`[email] Internal new order notification sent for ${orderCode}`);
}

// ─── Email 2: Customer — payment confirmed (→ customer_email) ─────────────────

export async function sendPaymentConfirmationToCustomer(stop: Stop): Promise<void> {
  const orderCode = stop.order_code ?? stop.id;

  if (!isIndividualOrder(stop)) {
    console.log(`[email] Payment confirmation skipped for ${orderCode} reason=not individual`);
    return;
  }

  const to = stop.customer_email;
  if (!to || !to.includes('@')) {
    console.log(`[email] Payment confirmation skipped for ${orderCode} reason=no customer_email`);
    return;
  }

  if (stop.payment_confirmation_sent_at) {
    console.log(`[email] Payment confirmation skipped for ${orderCode} reason=already sent`);
    return;
  }

  const resend = getResendClient();
  if (!resend) return;

  const from      = config.RESEND_FROM ?? 'LocalXpress <noreply@localxpress.app>';
  const subject   = `Pedido LocalXpress confirmado · ${orderCode}`;
  const scheduled = formatEmailDate(stop.scheduled_pickup_at);

  const rows: EmailRow[] = [
    { label: 'Código de pedido', value: orderCode, bold: true },
    { label: 'Fecha del servicio', value: scheduled },
    { label: 'Recogida', value: stop.pickup_address },
    { label: 'Entrega', value: stop.delivery_address },
    ...(stop.client_name ? [{ label: 'Nombre destinatario', value: stop.client_name }] : []),
    ...(stop.client_phone ? [{ label: 'Teléfono destinatario', value: stop.client_phone }] : []),
  ];

  const textLines = [
    `Hola,`,
    ``,
    `Hemos recibido correctamente tu solicitud de envío y el pago se ha confirmado con éxito.`,
    `Nuestro equipo gestionará el servicio según la fecha y hora seleccionadas.`,
    ``,
    `Código de pedido:    ${orderCode}`,
    `Fecha del servicio:  ${scheduled}`,
    `Recogida:            ${stop.pickup_address}`,
    `Entrega:             ${stop.delivery_address}`,
    stop.client_name  ? `Destinatario:        ${stop.client_name}`  : null,
    stop.client_phone ? `Teléfono:            ${stop.client_phone}` : null,
    ``,
    `Gracias por confiar en LocalXpress.`,
    getSupportFooterText(),
  ].filter((l): l is string => l !== null).join('\n');

  const extraHtml = `
    <p style="margin:20px 0 0;font-size:15px;color:#374151;line-height:1.6;">
      Hemos recibido correctamente tu solicitud de envío y el pago se ha confirmado con éxito.<br>
      Nuestro equipo gestionará el servicio según la fecha y hora seleccionadas.
    </p>`;

  const html = buildEmailHtml({
    headerBg: '#eff6ff',
    headerTitleColor: '#1d4ed8',
    headerBodyColor: '#3b82f6',
    headerEmoji: '✅',
    headerTitle: 'Pedido confirmado',
    headerSubtitle: 'Pago recibido — tu envío está en marcha',
    rows,
    extraHtml,
    footerHtml: getSupportFooterHtml(),
  });

  await resend.emails.send({ from, to, subject, text: textLines, html });
  console.log(`[email] Payment confirmation sent to ${to} for ${orderCode}`);

  // Persist idempotency guard
  queryOne(
    `UPDATE stops SET payment_confirmation_sent_at = NOW(), payment_confirmation_error = NULL WHERE id = $1`,
    [stop.id],
  ).catch((err) => console.error(`[email] Failed to persist payment_confirmation_sent_at for ${orderCode}:`, err));
}

// ─── Email 3: Customer — delivery notification (→ customer_email) ─────────────

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
    console.log(`[email] Delivery notification skipped for ${orderCode} reason=already sent`);
    return;
  }

  const resend = getResendClient();
  if (!resend) return;

  const from        = config.RESEND_FROM ?? 'LocalXpress <noreply@localxpress.app>';
  const subject     = `Tu pedido LocalXpress ${orderCode} ha sido entregado`;
  const deliveredAt = formatEmailDate(stop.delivered_at);

  // Compress proof photo (never blocks — null on any failure)
  const attachment = await compressProofPhoto(orderCode, stop.proof_photo_url);
  const hasPhoto   = attachment !== null;

  const rows: EmailRow[] = [
    { label: 'Código de pedido', value: orderCode, bold: true },
    { label: 'Entregado el', value: deliveredAt },
    { label: 'Dirección de entrega', value: stop.delivery_address },
  ];

  const textLines = [
    `Hola,`,
    ``,
    `Tu pedido ha sido entregado correctamente.`,
    ``,
    `Código de pedido:    ${orderCode}`,
    `Entregado el:        ${deliveredAt}`,
    `Dirección:           ${stop.delivery_address}`,
    hasPhoto ? `\nAdjuntamos el comprobante de entrega.` : ``,
    ``,
    `Gracias por confiar en LocalXpress.`,
    getSupportFooterText(),
  ].join('\n');

  const extraHtml = hasPhoto
    ? `<p style="margin:16px 0 0;font-size:13px;color:#6b7280;">Adjuntamos el comprobante de entrega.</p>`
    : '';

  const html = buildEmailHtml({
    headerBg: '#f0fdf4',
    headerTitleColor: '#15803d',
    headerBodyColor: '#22c55e',
    headerEmoji: '📦',
    headerTitle: 'Pedido entregado',
    headerSubtitle: 'Tu envío ha llegado a su destino',
    rows,
    extraHtml,
    footerHtml: getSupportFooterHtml(),
  });

  const attachments = attachment ? [attachment] : undefined;

  console.log(`[email] Delivery notification queued for ${orderCode}`);
  await resend.emails.send({ from, to, subject, text: textLines, html, attachments });
  console.log(`[email] Delivery notification sent to ${to} for ${orderCode}`);
}
