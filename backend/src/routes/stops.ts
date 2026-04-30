import { Router, Request, Response, NextFunction } from 'express';
import { query, queryOne, withTransaction } from '../db';
import { requireAuth, requireApiKey } from '../middleware/auth';
import { requireAdmin } from '../middleware/roles';
import { createStopSchema, updateStopSchema, updateStopStatusSchema, createOrderApiSchema } from '../utils/schemas';
import { AuthenticatedRequest, Stop } from '../types';
import { ok, created, noContent, parsePagination } from '../utils/response';
import { AppError } from '../middleware/errorHandler';
import { archiveStops } from '../scripts/archive-stops';
import { sendNewStopNotification } from '../services/email';

const router = Router();

// ─── B2B order creation (API key auth, no JWT needed) ─────────────────────────
router.post('/order', requireApiKey, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createOrderApiSchema.parse(req.body);
    const orderCode = await generateOrderCode(data.scheduled_pickup_at ?? null);

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

    // ── Source/email traceability ─────────────────────────────────────────────
    const source       = data.source       ?? 'api';
    const emailFrom    = data.email_from   ?? null;
    const emailSubject = data.email_subject ?? null;

    const stop = await queryOne<Stop>(
      `INSERT INTO stops
         (order_code, pickup_address, delivery_address, client_name, client_phone,
          client_notes, package_size, shop_name, scheduled_pickup_at, status,
          distance_km, price, price_driver, price_company,
          source, email_from, email_subject)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        orderCode,
        data.pickup_address,
        data.delivery_address,
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
      ]
    );

    res.status(201).json({ ok: true, stop });
    if (stop) sendNewStopNotification(stop).catch((err) => console.error('[email] Error enviando notificación:', err));
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
  } catch (err) {
    next(err);
  }
});

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

async function generateOrderCode(referenceDate?: string | null): Promise<string> {
  const date = referenceDate ? new Date(referenceDate) : new Date();
  const dayCode = date.getDate() + 27;
  const monthLetter = MONTH_LETTERS[date.getMonth() + 1];

  // Get the global maximum P number across all existing order codes
  const row = await queryOne<{ max_p: number }>(
    `SELECT COALESCE(
       MAX(CAST(SUBSTRING(order_code, '-P([0-9]+)$') AS INTEGER)),
       79
     ) AS max_p
     FROM stops
     WHERE order_code LIKE 'LX-D%-P%'`,
    []
  );

  let currentMax = row?.max_p ?? 79;

  for (let attempt = 0; attempt < 5; attempt++) {
    const increment = Math.floor(Math.random() * 5) + 1; // +1 to +5
    currentMax += increment;
    const code = `LX-D${dayCode}${monthLetter}-P${currentMax}`;
    const exists = await queryOne('SELECT 1 AS one FROM stops WHERE order_code = $1', [code]);
    if (!exists) return code;
  }

  // Rare fallback: bump well above current max to ensure uniqueness
  return `LX-D${dayCode}${monthLetter}-P${currentMax + Math.floor(Math.random() * 20) + 10}`;
}

export default router;
