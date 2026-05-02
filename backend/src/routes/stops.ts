import { Router, Request, Response, NextFunction } from 'express';
import { query, queryOne, withTransaction } from '../db';
import { requireAuth, requireApiKey } from '../middleware/auth';
import { requireAdmin } from '../middleware/roles';
import { createStopSchema, updateStopSchema, updateStopStatusSchema, createOrderApiSchema } from '../utils/schemas';
import { AuthenticatedRequest, Stop } from '../types';
import { ok, created, noContent, parsePagination } from '../utils/response';
import { AppError } from '../middleware/errorHandler';
import { archiveStops } from '../scripts/archive-stops';
import { sendNewStopNotification, sendPaymentConfirmationToCustomer, sendIndividualDeliveryNotification } from '../services/email';
import { geocodeAddress } from '../services/distance';

const router = Router();

// ─── B2B order creation (API key auth, no JWT needed) ─────────────────────────
router.post('/order', requireApiKey, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createOrderApiSchema.parse(req.body);

    // ── Resolve order type first (needed for prefix and order_code logic) ────
    const source    = data.source ?? 'api';
    const orderType = source === 'individual_web'
      ? 'individual'
      : (data.order_type ?? 'business');
    const isIndividual = orderType === 'individual';

    // ── Objective 3: Stripe deduplication — highest priority ─────────────────
    if (data.stripe_checkout_session_id) {
      const existing = await queryOne<Stop>(
        `SELECT * FROM stops WHERE stripe_checkout_session_id = $1 LIMIT 1`,
        [data.stripe_checkout_session_id],
      );
      if (existing) {
        return res.status(200).json({ ok: true, stop: existing, duplicate: true });
      }
    }

    // ── Objective 2: optional external order_code (individual orders only) ───
    let orderCode: string;

    if (data.order_code) {
      if (!isIndividual) {
        return res.status(400).json({ error: 'order_code externo solo se acepta para pedidos particulares' });
      }
      if (!LXP_CODE_REGEX.test(data.order_code)) {
        return res.status(400).json({ error: 'Formato de order_code inválido. Debe ser LXP-D{número}{letrasMes}-P{número}' });
      }
      // Check if code already exists
      const codeExists = await queryOne<Stop>('SELECT * FROM stops WHERE order_code = $1 LIMIT 1', [data.order_code]);
      if (codeExists) {
        // If same Stripe session, already handled above — this means different session, real conflict
        return res.status(409).json({ error: 'order_code already exists' });
      }
      orderCode = data.order_code;
    } else {
      // Objective 1: auto-generate with correct prefix
      const prefix = isIndividual ? 'LXP' : 'LX';
      orderCode = await generateOrderCode(data.scheduled_pickup_at ?? null, prefix);
    }

    // ── Pricing: calculate from pricing_zones if distance_km is provided ────────
    const MARGIN_KM = 0.15;
    let resolvedPrice: number | null = null;
    let resolvedPriceDriver: number | null = null;
    let resolvedPriceCompany: number | null = null;

    if (data.distance_km != null) {
      const adjusted = data.distance_km + MARGIN_KM;
      const zone = await queryOne<{
        fixed_price: number | null;
        per_km_price: number | null;
        min_km: number;
      }>(
        `SELECT fixed_price, per_km_price, min_km
         FROM pricing_zones
         WHERE $1 > min_km AND ($1 <= max_km OR max_km IS NULL)
         ORDER BY sort_order ASC
         LIMIT 1`,
        [adjusted]
      );
      if (zone) {
        if (zone.fixed_price != null) {
          resolvedPrice = zone.fixed_price;
        } else if (zone.per_km_price != null) {
          const extraKm = Math.max(0, data.distance_km - zone.min_km);
          resolvedPrice = Math.round(zone.per_km_price * extraKm * 100) / 100;
        }
      }
    }

    if (resolvedPrice != null) {
      resolvedPriceDriver  = Math.round(resolvedPrice * 0.70 * 100) / 100;
      resolvedPriceCompany = Math.round((resolvedPrice - resolvedPriceDriver) * 100) / 100;
    }

    // ── Fase 1 debug log for individual_web orders ───────────────────────────
    if (source === 'individual_web') {
      console.log(`[order] individual_web ${orderCode} coords incoming:`,
        { pickup_lat: data.pickup_lat, pickup_lng: data.pickup_lng,
          delivery_lat: data.delivery_lat, delivery_lng: data.delivery_lng });
    }

    // ── Fase 2: Auto-geocode missing coords before INSERT ─────────────────
    let finalPickupLat  = data.pickup_lat  ?? null;
    let finalPickupLng  = data.pickup_lng  ?? null;
    let finalDeliveryLat = data.delivery_lat ?? null;
    let finalDeliveryLng = data.delivery_lng ?? null;

    if ((finalPickupLat == null || finalPickupLng == null) && data.pickup_address) {
      const r = await geocodeAddress(data.pickup_address);
      if (r.ok) { finalPickupLat = r.lat; finalPickupLng = r.lng; }
      else console.warn(`[geocode] pickup failed for ${orderCode}: ${r.google_status} — ${r.error_message}`);
    }
    if ((finalDeliveryLat == null || finalDeliveryLng == null) && data.delivery_address) {
      const r = await geocodeAddress(data.delivery_address);
      if (r.ok) { finalDeliveryLat = r.lat; finalDeliveryLng = r.lng; }
      else console.warn(`[geocode] delivery failed for ${orderCode}: ${r.google_status} — ${r.error_message}`);
    }

    // ── Remaining scalar fields ──────────────────────────────────────────────
    const emailFrom    = data.email_from   ?? null;
    const emailSubject = data.email_subject ?? null;

    const paymentStatus   = data.payment_status ?? 'unpaid';
    const isPaidIndividual = isIndividual && paymentStatus === 'paid';
    const paidByClient    = isPaidIndividual;
    const paidByClientAt  = isPaidIndividual ? new Date() : null;

    const stop = await queryOne<Stop>(
      `INSERT INTO stops
         (order_code,
          pickup_address, pickup_lat, pickup_lng,
          delivery_address, delivery_lat, delivery_lng,
          client_name, client_phone,
          client_notes, package_size, shop_name, scheduled_pickup_at, status,
          distance_km, price, price_driver, price_company,
          source, email_from, email_subject,
          order_type, payment_status, paid_by_client, paid_by_client_at,
          customer_email, customer_full_name, customer_phone,
          stripe_checkout_session_id, stripe_payment_intent_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',
               $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
       RETURNING *`,
      [
        orderCode,
        data.pickup_address,
        finalPickupLat,
        finalPickupLng,
        data.delivery_address,
        finalDeliveryLat,
        finalDeliveryLng,
        data.client_name,
        data.client_phone   ?? null,
        data.client_notes   ?? null,
        data.package_size   ?? 'medium',
        data.shop_name      ?? null,
        data.scheduled_pickup_at ?? null,
        data.distance_km    ?? null,
        resolvedPrice,
        resolvedPriceDriver,
        resolvedPriceCompany,
        source,
        emailFrom,
        emailSubject,
        orderType,
        paymentStatus,
        paidByClient,
        paidByClientAt,
        data.customer_email      ?? null,
        data.customer_full_name  ?? null,
        data.customer_phone      ?? null,
        data.stripe_checkout_session_id ?? null,
        data.stripe_payment_intent_id   ?? null,
      ]
    );

    res.status(201).json({ ok: true, stop });
    if (stop) {
      // Internal notification always fires
      sendNewStopNotification(stop).catch((err) => console.error('[email] Internal notification error:', err));
      // Customer confirmation only for paid individual orders (guard inside the function)
      if (isIndividual && paymentStatus === 'paid') {
        sendPaymentConfirmationToCustomer(stop).catch((err) => console.error('[email] Payment confirmation error:', err));
      }
    }
  } catch (err) {
    next(err);
  }
});

// All routes below require JWT
router.use(requireAuth);

// GET /api/stops — filtered by role
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { role, profileId } = authReq.user;
    const { limit, offset, page } = parsePagination(req.query as Record<string, unknown>);

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (role === 'driver') {
      conditions.push(`s.driver_id = $${idx++}`);
      params.push(profileId);
    } else if (role === 'shop') {
      conditions.push(`s.shop_id = $${idx++}`);
      params.push(profileId);
    }

    // optional filters
    if (req.query.status) {
      conditions.push(`s.status = $${idx++}`);
      params.push(req.query.status);
    }
    if (req.query.driver_id && role === 'admin') {
      conditions.push(`s.driver_id = $${idx++}`);
      params.push(req.query.driver_id);
    }

    // Date filters — admin only
    // date=YYYY-MM-DD filters by scheduled_pickup_at date, falling back to created_at date
    if (role === 'admin' && req.query.date) {
      conditions.push(
        `(s.scheduled_pickup_at::date = $${idx} OR (s.scheduled_pickup_at IS NULL AND s.created_at::date = $${idx}))`,
      );
      params.push(req.query.date);
      idx++;
    } else if (role === 'admin') {
      if (req.query.date_from) {
        conditions.push(`COALESCE(s.scheduled_pickup_at, s.created_at) >= $${idx++}::date`);
        params.push(req.query.date_from);
      }
      if (req.query.date_to) {
        conditions.push(`COALESCE(s.scheduled_pickup_at, s.created_at) < ($${idx++}::date + interval '1 day')`);
        params.push(req.query.date_to);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [stops, countRow] = await Promise.all([
      query<Stop & { driver_name: string; shop_profile_name: string }>(
        `SELECT s.*,
                dp.full_name AS driver_name,
                sp.full_name AS shop_profile_name
         FROM stops s
         LEFT JOIN profiles dp ON s.driver_id = dp.id
         LEFT JOIN profiles sp ON s.shop_id = sp.id
         ${whereClause}
         ORDER BY s.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limit, offset]
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM stops s ${whereClause}`,
        params
      ),
    ]);

    ok(res, {
      data: stops,
      total: parseInt(countRow?.count ?? '0'),
      page,
      limit,
      totalPages: Math.ceil(parseInt(countRow?.count ?? '0') / limit),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/stops/archived — role-filtered archived stops (must be before /:id)
router.get('/archived', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { role, profileId } = authReq.user;
    const { limit, offset, page } = parsePagination(req.query as Record<string, unknown>);

    if (role === 'driver') {
      return ok(res, { data: [], total: 0, page: 1, limit, totalPages: 0 });
    }

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (role === 'shop') {
      conditions.push(`shop_id = $${idx++}`);
      params.push(profileId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, countRow] = await Promise.all([
      query<Record<string, unknown>>(
        `SELECT *, true AS is_archived FROM stops_archive ${where}
         ORDER BY archived_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limit, offset]
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*) AS count FROM stops_archive ${where}`,
        params
      ),
    ]);

    ok(res, {
      data: rows,
      total: parseInt(countRow?.count ?? '0'),
      page,
      limit,
      totalPages: Math.ceil(parseInt(countRow?.count ?? '0') / limit),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/stops/archive — admin triggers manual archive (supports ?dry_run=true)
router.post('/archive', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dryRun = req.query.dry_run === 'true';
    const result = await archiveStops(dryRun);
    ok(res, {
      message: dryRun ? 'Simulación completada (dry-run, no se archivó nada)' : 'Archivado completado',
      dryRun,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/stops/geocode-missing — admin: geocode stops missing coordinates
// Query params: date=YYYY-MM-DD | date_from+date_to | all=true (default: today)
router.post('/geocode-missing', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY no configurada en el servidor' });
    }

    const conditions: string[] = [
      `(pickup_lat IS NULL OR pickup_lng IS NULL OR delivery_lat IS NULL OR delivery_lng IS NULL)`,
      `pickup_address IS NOT NULL AND delivery_address IS NOT NULL`,
    ];
    const params: unknown[] = [];
    let idx = 1;

    const { date, date_from, date_to, all } = req.query as Record<string, string | undefined>;

    if (all === 'true') {
      // no date filter
    } else if (date) {
      conditions.push(
        `(scheduled_pickup_at::date = $${idx} OR (scheduled_pickup_at IS NULL AND created_at::date = $${idx}))`,
      );
      params.push(date); idx++;
    } else if (date_from || date_to) {
      if (date_from) { conditions.push(`COALESCE(scheduled_pickup_at, created_at) >= $${idx++}::date`); params.push(date_from); }
      if (date_to)   { conditions.push(`COALESCE(scheduled_pickup_at, created_at) < ($${idx++}::date + interval '1 day')`); params.push(date_to); }
    } else {
      // default: today
      const today = new Date().toISOString().slice(0, 10);
      conditions.push(
        `(scheduled_pickup_at::date = $${idx} OR (scheduled_pickup_at IS NULL AND created_at::date = $${idx}))`,
      );
      params.push(today); idx++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const missing = await query<{
      id: string; order_code: string | null;
      pickup_address: string; pickup_lat: number | null; pickup_lng: number | null;
      delivery_address: string; delivery_lat: number | null; delivery_lng: number | null;
    }>(
      `SELECT id, order_code, pickup_address, pickup_lat, pickup_lng, delivery_address, delivery_lat, delivery_lng
       FROM stops ${where}
       ORDER BY created_at DESC
       LIMIT 50`,
      params,
    );

    console.log(`[geocode-missing] found ${missing.length} stops`);

    let updated = 0, failed = 0;
    const items: {
      order_code: string | null;
      pickup_geocoded: boolean; delivery_geocoded: boolean;
      pickup_error: string | null; delivery_error: string | null;
      pickup_formatted_address: string | null; delivery_formatted_address: string | null;
    }[] = [];

    for (const stop of missing) {
      const item = {
        order_code: stop.order_code,
        pickup_geocoded: false,
        delivery_geocoded: false,
        pickup_error: null as string | null,
        delivery_error: null as string | null,
        pickup_formatted_address: null as string | null,
        delivery_formatted_address: null as string | null,
      };

      const fields: string[] = [];
      const vals: unknown[] = [];
      let fi = 1;

      if (stop.pickup_lat == null || stop.pickup_lng == null) {
        const r = await geocodeAddress(stop.pickup_address);
        if (r.ok) {
          fields.push(`pickup_lat = $${fi++}`, `pickup_lng = $${fi++}`);
          vals.push(r.lat, r.lng);
          item.pickup_geocoded = true;
          item.pickup_formatted_address = r.formatted_address;
          console.log(`[geocode-missing] ${stop.order_code} pickup OK → ${r.lat},${r.lng}`);
        } else {
          item.pickup_error = `${r.google_status}: ${r.error_message}`;
          console.warn(`[geocode-missing] ${stop.order_code} pickup FAILED ${r.google_status}: ${r.error_message}`);
        }
      } else {
        item.pickup_geocoded = true;
      }

      if (stop.delivery_lat == null || stop.delivery_lng == null) {
        const r = await geocodeAddress(stop.delivery_address);
        if (r.ok) {
          fields.push(`delivery_lat = $${fi++}`, `delivery_lng = $${fi++}`);
          vals.push(r.lat, r.lng);
          item.delivery_geocoded = true;
          item.delivery_formatted_address = r.formatted_address;
          console.log(`[geocode-missing] ${stop.order_code} delivery OK → ${r.lat},${r.lng}`);
        } else {
          item.delivery_error = `${r.google_status}: ${r.error_message}`;
          console.warn(`[geocode-missing] ${stop.order_code} delivery FAILED ${r.google_status}: ${r.error_message}`);
        }
      } else {
        item.delivery_geocoded = true;
      }

      if (fields.length > 0) {
        try {
          vals.push(stop.id);
          await queryOne(
            `UPDATE stops SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${fi}`,
            vals,
          );
          updated++;
        } catch (err) {
          item.pickup_geocoded = false;
          item.delivery_geocoded = false;
          item.pickup_error = String(err);
          failed++;
        }
      } else {
        // nothing new to save — at least one address failed for this stop
        if (item.pickup_error || item.delivery_error) failed++;
      }

      items.push(item);
    }

    console.log(`[geocode-missing] completed processed=${missing.length} updated=${updated} failed=${failed}`);
    ok(res, { processed: missing.length, updated, failed, remaining: missing.length - updated, items });
  } catch (err) {
    next(err);
  }
});

// POST /api/stops/geocode-test — admin: test geocoding for a single address
router.post('/geocode-test', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.body as { address?: string };
    if (!address || typeof address !== 'string' || !address.trim()) {
      return res.status(400).json({ ok: false, error: 'Missing address in body' });
    }
    const result = await geocodeAddress(address.trim());
    return res.json(result.ok
      ? { ok: true, lat: result.lat, lng: result.lng, formatted_address: result.formatted_address, google_status: result.google_status }
      : { ok: false, google_status: result.google_status, error_message: result.error_message }
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/stops/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { role, profileId } = authReq.user;

    const stop = await queryOne<Stop & { driver_name: string }>(
      `SELECT s.*, dp.full_name AS driver_name
       FROM stops s
       LEFT JOIN profiles dp ON s.driver_id = dp.id
       WHERE s.id = $1`,
      [req.params.id]
    );

    if (!stop) throw new AppError(404, 'Stop not found');

    if (role === 'driver' && stop.driver_id !== profileId) {
      throw new AppError(403, 'Access denied');
    }
    if (role === 'shop' && stop.shop_id !== profileId) {
      throw new AppError(403, 'Access denied');
    }

    ok(res, stop);
  } catch (err) {
    next(err);
  }
});

// POST /api/stops — admin or shop
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { role, profileId, sub } = authReq.user;

    if (role !== 'admin' && role !== 'shop') {
      throw new AppError(403, 'Only admin or shop can create stops');
    }

    const data = createStopSchema.parse(req.body);

    // shops can only create for themselves
    const shopId = role === 'shop' ? profileId : (data.shop_id ?? null);
    const orderCode = await generateOrderCode(data.scheduled_pickup_at ?? null);

    // Auto-calculate price, price_driver, price_company from pricing_zones
    let resolvedPrice = data.price ?? null;
    let resolvedPriceDriver = data.price_driver ?? null;
    let resolvedPriceCompany = data.price_company ?? null;

    if (data.distance_km != null && resolvedPrice == null) {
      const MARGIN_KM = 0.15;
      const adjusted = data.distance_km + MARGIN_KM;
      const zone = await queryOne<{
        fixed_price: number | null; per_km_price: number | null;
        min_km: number; price_driver: number | null;
      }>(
        `SELECT fixed_price, per_km_price, min_km, price_driver
         FROM pricing_zones
         WHERE $1 > min_km AND ($1 <= max_km OR max_km IS NULL)
         ORDER BY sort_order ASC
         LIMIT 1`,
        [adjusted]
      );
      if (zone) {
        if (zone.fixed_price != null) {
          resolvedPrice = zone.fixed_price;
        } else if (zone.per_km_price != null) {
          const extraKm = Math.max(0, data.distance_km - zone.min_km);
          resolvedPrice = Math.round(zone.per_km_price * extraKm * 100) / 100;
        }
      }
    }

    // price_driver = 70% of price, price_company = remaining 30%
    if (resolvedPrice != null && resolvedPriceDriver == null) {
      resolvedPriceDriver = Math.round(resolvedPrice * 0.70 * 100) / 100;
      resolvedPriceCompany = Math.round((resolvedPrice - resolvedPriceDriver) * 100) / 100;
    } else if (resolvedPrice != null && resolvedPriceDriver != null && resolvedPriceCompany == null) {
      resolvedPriceCompany = Math.round((resolvedPrice - resolvedPriceDriver) * 100) / 100;
    }

    const stop = await queryOne<Stop>(
      `INSERT INTO stops
         (order_code, pickup_address, pickup_lat, pickup_lng,
          delivery_address, delivery_lat, delivery_lng,
          client_name, client_phone, client_notes,
          driver_id, shop_id, created_by, status,
          package_size, distance_km, price, price_driver, price_company,
          shop_name, scheduled_pickup_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',$14,$15,$16,$17,$18,$19,$20)
       RETURNING *`,
      [
        orderCode,
        data.pickup_address,
        data.pickup_lat ?? null,
        data.pickup_lng ?? null,
        data.delivery_address,
        data.delivery_lat ?? null,
        data.delivery_lng ?? null,
        data.client_name,
        data.client_phone ?? null,
        data.client_notes ?? null,
        data.driver_id ?? null,
        shopId,
        sub,
        data.package_size ?? 'medium',
        data.distance_km ?? null,
        resolvedPrice,
        resolvedPriceDriver,
        resolvedPriceCompany,
        data.shop_name ?? null,
        data.scheduled_pickup_at ?? null,
      ]
    );

    created(res, stop);
    if (stop) sendNewStopNotification(stop).catch((err) => console.error('[email] Error enviando notificación:', err));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/stops/:id — admin full, driver limited
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { role, profileId } = authReq.user;

    const existing = await queryOne<Stop>('SELECT * FROM stops WHERE id = $1', [req.params.id]);
    if (!existing) throw new AppError(404, 'Stop not found');

    if (role === 'driver') {
      if (existing.driver_id !== profileId) throw new AppError(403, 'Access denied');
      // drivers can only update status and proof_photo_url
      const allowed = updateStopStatusSchema.parse(req.body);
      const updated = await queryOne<Stop>(
        `UPDATE stops
         SET status = $1::stop_status,
             proof_photo_url = COALESCE($2, proof_photo_url),
             picked_at = CASE WHEN $1::stop_status = 'picked' THEN NOW() ELSE picked_at END,
             delivered_at = CASE WHEN $1::stop_status = 'delivered' THEN NOW() ELSE delivered_at END,
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [allowed.status, allowed.proof_photo_url ?? null, req.params.id]
      );
      ok(res, updated);

      // Fire delivery notification in background — never block the driver response
      if (
        updated &&
        allowed.status === 'delivered' &&
        existing.status !== 'delivered'
      ) {
        fireDeliveryNotification(updated);
      }
      return;
    }

    if (role === 'shop') {
      if (existing.shop_id !== profileId) throw new AppError(403, 'Access denied');
      if (existing.status === 'delivered') throw new AppError(400, 'Cannot modify delivered stop');
    }

    const data = updateStopSchema.parse(req.body);
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        const placeholder = key === 'status' ? `$${idx++}::stop_status` : `$${idx++}`;
        fields.push(`${key} = ${placeholder}`);
        values.push(val);
      }
    }

    // auto-set timestamps for status changes
    if (data.status === 'picked') { fields.push(`picked_at = $${idx++}`); values.push(new Date()); }
    if (data.status === 'delivered') { fields.push(`delivered_at = $${idx++}`); values.push(new Date()); }
    if (data.paid_by_client === true) { fields.push(`paid_by_client_at = $${idx++}`); values.push(new Date()); }
    if (data.paid_to_driver === true) { fields.push(`paid_to_driver_at = $${idx++}`); values.push(new Date()); }

    if (fields.length === 0) throw new AppError(400, 'No fields to update');

    values.push(req.params.id);
    const updated = await queryOne<Stop>(
      `UPDATE stops SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      values
    );

    ok(res, updated);

    // Fire delivery notification in background — never block the admin response
    if (
      updated &&
      data.status === 'delivered' &&
      existing.status !== 'delivered'
    ) {
      fireDeliveryNotification(updated);
    }
  } catch (err) {
    next(err);
  }
});

// Helper: send delivery notification and persist outcome — runs in background
function fireDeliveryNotification(stop: Stop): void {
  sendIndividualDeliveryNotification(stop)
    .then(() => {
      // Mark as notified
      queryOne(
        `UPDATE stops SET delivery_notified_at = NOW(), delivery_notification_error = NULL WHERE id = $1`,
        [stop.id],
      ).catch((err) => console.error(`[email] Failed to persist delivery_notified_at for ${stop.order_code}:`, err));
    })
    .catch((err: unknown) => {
      const msg = String(err).slice(0, 500);
      console.error(`[email] Delivery notification failed for ${stop.order_code}: ${msg}`);
      queryOne(
        `UPDATE stops SET delivery_notification_error = $1 WHERE id = $2`,
        [msg, stop.id],
      ).catch((e) => console.error(`[email] Failed to persist delivery_notification_error for ${stop.order_code}:`, e));
    });
}

// DELETE /api/stops/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { role, profileId } = authReq.user;

    const existing = await queryOne<Stop>('SELECT * FROM stops WHERE id = $1', [req.params.id]);
    if (!existing) throw new AppError(404, 'Stop not found');

    if (role === 'shop') {
      if (existing.shop_id !== profileId) throw new AppError(403, 'Access denied');
      if (existing.status === 'delivered') throw new AppError(400, 'Cannot delete a delivered stop');
    } else if (role !== 'admin') {
      throw new AppError(403, 'Access denied');
    }

    await withTransaction(async (client) => {
      await client.query('DELETE FROM order_photos WHERE stop_id = $1', [req.params.id]);
      await client.query('DELETE FROM stops WHERE id = $1', [req.params.id]);
    });

    noContent(res);
  } catch (err) {
    next(err);
  }
});

const MONTH_LETTERS: Record<number, string> = {
  1: 'E', 2: 'F', 3: 'M', 4: 'A', 5: 'MY',
  6: 'JN', 7: 'JL', 8: 'AG', 9: 'S', 10: 'O',
  11: 'N', 12: 'D',
};

// LXP- regex: accepts external codes from the individual orders app
const LXP_CODE_REGEX = /^LXP-D\d+[A-Z]+-P\d+$/;

async function generateOrderCode(
  referenceDate?: string | null,
  prefix: 'LX' | 'LXP' = 'LX',
): Promise<string> {
  const date = referenceDate ? new Date(referenceDate) : new Date();
  const dayCode = date.getDate() + 27;
  const monthLetter = MONTH_LETTERS[date.getMonth() + 1];

  // Query max P-number across both LX- and LXP- codes so numbers never collide
  const row = await queryOne<{ max_p: number }>(
    `SELECT COALESCE(
       MAX(CAST(SUBSTRING(order_code, '-P([0-9]+)$') AS INTEGER)),
       79
     ) AS max_p
     FROM stops
     WHERE order_code LIKE 'LX-D%-P%' OR order_code LIKE 'LXP-D%-P%'`,
    [],
  );

  let currentMax = row?.max_p ?? 79;

  for (let attempt = 0; attempt < 5; attempt++) {
    currentMax += Math.floor(Math.random() * 5) + 1;
    const code = `${prefix}-D${dayCode}${monthLetter}-P${currentMax}`;
    const exists = await queryOne('SELECT 1 AS one FROM stops WHERE order_code = $1', [code]);
    if (!exists) return code;
  }

  return `${prefix}-D${dayCode}${monthLetter}-P${currentMax + Math.floor(Math.random() * 20) + 10}`;
}

export default router;
