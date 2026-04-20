import { Router, Request, Response, NextFunction } from 'express';
import { query, queryOne } from '../db';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/roles';
import { createPricingZoneSchema, updatePricingZoneSchema } from '../utils/schemas';
import { PricingZone } from '../types';
import { ok, created, noContent } from '../utils/response';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(requireAuth);

// GET /api/pricing-zones — all authenticated users
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const zones = await query<PricingZone>(
      'SELECT * FROM pricing_zones ORDER BY sort_order ASC, min_km ASC'
    );
    ok(res, zones);
  } catch (err) {
    next(err);
  }
});

// GET /api/pricing-zones/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const zone = await queryOne<PricingZone>(
      'SELECT * FROM pricing_zones WHERE id = $1',
      [req.params.id]
    );
    if (!zone) throw new AppError(404, 'Pricing zone not found');
    ok(res, zone);
  } catch (err) {
    next(err);
  }
});

// POST /api/pricing-zones — admin only
router.post('/', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createPricingZoneSchema.parse(req.body);
    const zone = await queryOne<PricingZone>(
      `INSERT INTO pricing_zones (name, min_km, max_km, fixed_price, per_km_price, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.name, data.min_km, data.max_km ?? null, data.fixed_price ?? null, data.per_km_price ?? null, data.sort_order]
    );
    created(res, zone);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/pricing-zones/:id — admin only
router.patch('/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updatePricingZoneSchema.parse(req.body);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }

    if (fields.length === 0) throw new AppError(400, 'No fields to update');

    values.push(req.params.id);
    const updated = await queryOne<PricingZone>(
      `UPDATE pricing_zones SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${idx}
       RETURNING *`,
      values
    );
    if (!updated) throw new AppError(404, 'Pricing zone not found');
    ok(res, updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/pricing-zones/:id — admin only
router.delete('/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      'DELETE FROM pricing_zones WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.length === 0) throw new AppError(404, 'Pricing zone not found');
    noContent(res);
  } catch (err) {
    next(err);
  }
});

export default router;
