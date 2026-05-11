import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { queryOne } from '../db';
import { config } from '../config';
import { sendNewStopNotification, sendPaymentConfirmationToCustomer } from '../services/email';
import { Stop } from '../types';
import { generateOrderCode } from '../services/orderCode';

const router = Router();

// ─── POST /api/stripe/webhook ─────────────────────────────────────────────────
// Must be mounted with express.raw() middleware — see index.ts

router.post('/webhook', async (req: Request, res: Response) => {
  if (!config.STRIPE_SECRET_KEY || !config.STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe/webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;
  try {
    const stripe = new Stripe(config.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      config.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed:', err);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = event.data.object as any;

  try {
    await handleSessionCompleted(session);
  } catch (err) {
    console.error('[stripe/webhook] Error processing session:', err);
    // Still return 200 so Stripe does not retry an unrecoverable error
    return res.status(200).json({ received: true, warning: 'Processing error, check logs' });
  }

  return res.status(200).json({ received: true });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSessionCompleted(session: any): Promise<void> {
  const sessionId = session.id;

  // Idempotency: skip if already processed
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM stops WHERE stripe_checkout_session_id = $1 LIMIT 1`,
    [sessionId],
  );
  if (existing) {
    console.log(`[stripe/webhook] Session ${sessionId} already processed — skipping`);
    return;
  }

  const m = session.metadata ?? {};

  const distance_km     = m.distance_km     ? parseFloat(m.distance_km)     : null;
  const price           = m.price           ? parseFloat(m.price)           : null;
  const price_driver    = m.price_driver    ? parseFloat(m.price_driver)    : null;
  const price_company   = m.price_company   ? parseFloat(m.price_company)   : null;
  const pickup_lat      = m.pickup_lat      ? parseFloat(m.pickup_lat)      : null;
  const pickup_lng      = m.pickup_lng      ? parseFloat(m.pickup_lng)      : null;
  const delivery_lat    = m.delivery_lat    ? parseFloat(m.delivery_lat)    : null;
  const delivery_lng    = m.delivery_lng    ? parseFloat(m.delivery_lng)    : null;

  // ── Scheduled time normalization (same logic as /order endpoint) ─────────
  const scheduledTimeType = (m.scheduled_time_type as string) || null;
  const scheduledTimeRaw  = (m.scheduled_time      as string) || null;

  let finalScheduledTime: string | null;
  let finalScheduledPickupAt: string | null;

  if (scheduledTimeType === 'asap') {
    finalScheduledTime     = 'Lo antes posible';
    finalScheduledPickupAt = null;
  } else if (scheduledTimeType === 'morning') {
    finalScheduledTime     = scheduledTimeRaw ?? 'Mañana (10:00-14:00)';
    finalScheduledPickupAt = null;
  } else if (scheduledTimeType === 'afternoon') {
    finalScheduledTime     = scheduledTimeRaw ?? 'Tarde (16:00-20:00)';
    finalScheduledPickupAt = null;
  } else if (scheduledTimeType === 'specific') {
    finalScheduledTime     = scheduledTimeRaw;
    finalScheduledPickupAt = m.scheduled_pickup_at || null;
  } else {
    // No type in metadata — backwards compatible
    finalScheduledTime     = scheduledTimeRaw;
    finalScheduledPickupAt = m.scheduled_pickup_at || null;
  }

  const orderCode = await generateOrderCode(finalScheduledPickupAt, 'LXP');

  const stop = await queryOne<Stop>(
    `INSERT INTO stops
       (order_code,
        pickup_address, pickup_lat, pickup_lng,
        delivery_address, delivery_lat, delivery_lng,
        client_name, client_phone, client_notes,
        package_size, scheduled_pickup_at, scheduled_time, scheduled_time_type,
        distance_km, price, price_driver, price_company,
        status, paid_by_client, paid_by_client_at,
        source, order_type, payment_status,
        stripe_checkout_session_id, stripe_payment_intent_id,
        customer_email, customer_full_name, customer_phone)
     VALUES
       ($1, $2,$3,$4, $5,$6,$7, $8,$9,$10, $11,$12,$13,$14,
        $15,$16,$17,$18,
        'pending', true, NOW(),
        'individual_web','individual','paid',
        $19,$20, $21,$22,$23)
     RETURNING *`,
    [
      orderCode,
      m.pickup_address   ?? '',
      pickup_lat,
      pickup_lng,
      m.delivery_address ?? '',
      delivery_lat,
      delivery_lng,
      m.client_name      ?? '',
      m.client_phone     || null,
      m.client_notes     || null,
      m.package_size     || 'medium',
      finalScheduledPickupAt,
      finalScheduledTime,
      scheduledTimeType,
      distance_km,
      price,
      price_driver,
      price_company,
      sessionId,
      (session.payment_intent as string) || null,
      m.customer_email   || session.customer_email || null,
      m.client_name      || null,
      m.client_phone     || null,
    ],
  );

  console.log(`[stripe/webhook] Stop created: ${stop?.order_code} (session ${sessionId})`);

  if (stop) {
    // Emails are intentionally skipped for individual_web orders:
    // the lxp-ind app sends its own confirmation to the customer and admin.
    console.log(`[stripe/webhook] Emails suppressed for individual_web stop ${stop.order_code}`);
  }
}

export default router;
