import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import Stripe from 'stripe';
import { queryOne } from '../db';
import { config } from '../config';
import { getDrivingDistance } from '../services/distance';

const router = Router();

const MARGIN_KM = 0.15;

// ─── Rate limiters ────────────────────────────────────────────────────────────

const quoteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests, please try again later.' },
});

const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many checkout requests, please try again later.' },
});

// ─── Schemas ──────────────────────────────────────────────────────────────────

const quoteSchema = z.object({
  pickup_address: z.string().min(1),
  pickup_lat: z.number(),
  pickup_lng: z.number(),
  delivery_address: z.string().min(1),
  delivery_lat: z.number(),
  delivery_lng: z.number(),
  scheduled_pickup_at: z.string().datetime({ offset: true }).optional().nullable(),
  package_size: z.enum(['small', 'medium', 'large']).optional().default('medium'),
});

const checkoutSchema = z.object({
  pickup_address: z.string().min(1),
  pickup_lat: z.number(),
  pickup_lng: z.number(),
  delivery_address: z.string().min(1),
  delivery_lat: z.number(),
  delivery_lng: z.number(),
  client_name: z.string().min(1).max(255),
  client_phone: z.string().min(1).max(50),
  customer_email: z.string().email().max(320),
  scheduled_pickup_at: z.string().datetime({ offset: true }).optional().nullable(),
  client_notes: z.string().max(2000).optional().nullable(),
  package_size: z.enum(['small', 'medium', 'large']).optional().default('medium'),
});

// ─── Pricing helper ───────────────────────────────────────────────────────────

interface PriceResult {
  zone_name: string;
  zone_range: string;
  price: number;
  price_driver: number;
  price_company: number;
}

async function calculatePrice(distance_km: number): Promise<PriceResult | null> {
  const adjusted = distance_km + MARGIN_KM;

  const zone = await queryOne<{
    name: string;
    min_km: number;
    max_km: number | null;
    fixed_price: number | null;
    per_km_price: number | null;
  }>(
    `SELECT name, min_km, max_km, fixed_price, per_km_price
     FROM pricing_zones
     WHERE $1 > min_km AND ($1 <= max_km OR max_km IS NULL)
     ORDER BY sort_order ASC
     LIMIT 1`,
    [adjusted],
  );

  if (!zone) return null;

  let price: number;
  if (zone.fixed_price != null) {
    price = zone.fixed_price;
  } else if (zone.per_km_price != null) {
    const extraKm = Math.max(0, distance_km - zone.min_km);
    price = Math.round(zone.per_km_price * extraKm * 100) / 100;
  } else {
    return null;
  }

  const price_driver  = Math.round(price * 0.70 * 100) / 100;
  const price_company = Math.round((price - price_driver) * 100) / 100;

  const rangeStr = zone.max_km != null
    ? `${zone.min_km}–${zone.max_km} km`
    : `>${zone.min_km} km`;

  return { zone_name: zone.name, zone_range: rangeStr, price, price_driver, price_company };
}

// ─── POST /api/public/quote ───────────────────────────────────────────────────

router.post('/quote', quoteLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = quoteSchema.parse(req.body);

    const { distance_km } = await getDrivingDistance(
      data.pickup_lat,
      data.pickup_lng,
      data.delivery_lat,
      data.delivery_lng,
    );

    const pricing = await calculatePrice(distance_km);
    if (!pricing) {
      return res.status(422).json({ ok: false, error: 'No se encontró zona de precio para esta distancia.' });
    }

    return res.json({
      ok: true,
      distance_km,
      zone: { name: pricing.zone_name, range: pricing.zone_range },
      price: pricing.price,
      price_driver: pricing.price_driver,
      price_company: pricing.price_company,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: 'Datos inválidos.', details: err.errors });
    }
    next(err);
  }
});

// ─── POST /api/public/checkout ────────────────────────────────────────────────

router.post('/checkout', checkoutLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!config.STRIPE_SECRET_KEY) {
      return res.status(503).json({ ok: false, error: 'El pago online no está configurado. Contacta con LocalXpress.' });
    }

    const data = checkoutSchema.parse(req.body);

    const { distance_km } = await getDrivingDistance(
      data.pickup_lat,
      data.pickup_lng,
      data.delivery_lat,
      data.delivery_lng,
    );

    const pricing = await calculatePrice(distance_km);
    if (!pricing) {
      return res.status(422).json({ ok: false, error: 'No se encontró zona de precio para esta distancia.' });
    }

    const stripe = new Stripe(config.STRIPE_SECRET_KEY);
    const amountCents = Math.round(pricing.price * 100);

    const successUrl = config.PUBLIC_APP_SUCCESS_URL ?? 'https://pedidos.localxpress.app/success';
    const cancelUrl  = config.PUBLIC_APP_CANCEL_URL  ?? 'https://pedidos.localxpress.app/cancel';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: data.customer_email,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            unit_amount: amountCents,
            product_data: {
              name: 'Entrega LocalXpress',
              description: `${data.pickup_address} → ${data.delivery_address}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        pickup_address:      data.pickup_address,
        pickup_lat:          String(data.pickup_lat),
        pickup_lng:          String(data.pickup_lng),
        delivery_address:    data.delivery_address,
        delivery_lat:        String(data.delivery_lat),
        delivery_lng:        String(data.delivery_lng),
        client_name:         data.client_name,
        client_phone:        data.client_phone,
        customer_email:      data.customer_email,
        scheduled_pickup_at: data.scheduled_pickup_at ?? '',
        client_notes:        data.client_notes ?? '',
        package_size:        data.package_size,
        distance_km:         String(distance_km),
        price:               String(pricing.price),
        price_driver:        String(pricing.price_driver),
        price_company:       String(pricing.price_company),
        order_type:          'individual',
        source:              'individual_web',
      },
    });

    return res.json({ ok: true, checkout_url: session.url });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: 'Datos inválidos.', details: err.errors });
    }
    next(err);
  }
});

export default router;
