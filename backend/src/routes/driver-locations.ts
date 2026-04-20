import { Router, Request, Response, NextFunction } from 'express';
import { query, queryOne } from '../db';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/roles';
import { upsertLocationSchema } from '../utils/schemas';
import { AuthenticatedRequest, DriverLocation } from '../types';
import { ok, noContent } from '../utils/response';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(requireAuth);

// GET /api/driver-locations — admin: all; driver: own
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { role, profileId } = authReq.user;

    if (role === 'driver') {
      const loc = await queryOne<DriverLocation>(
        'SELECT * FROM driver_locations WHERE driver_id = $1',
        [profileId]
      );
      ok(res, loc ? [loc] : []);
      return;
    }

    if (role !== 'admin') {
      throw new AppError(403, 'Access denied');
    }

    const locations = await query<DriverLocation & { driver_name: string }>(
      `SELECT dl.*, p.full_name AS driver_name
       FROM driver_locations dl
       JOIN profiles p ON dl.driver_id = p.id
       ORDER BY dl.updated_at DESC`
    );

    ok(res, locations);
  } catch (err) {
    next(err);
  }
});

// GET /api/driver-locations/:driver_id — admin only
router.get('/:driver_id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const loc = await queryOne<DriverLocation & { driver_name: string }>(
      `SELECT dl.*, p.full_name AS driver_name
       FROM driver_locations dl
       JOIN profiles p ON dl.driver_id = p.id
       WHERE dl.driver_id = $1`,
      [req.params.driver_id]
    );
    if (!loc) throw new AppError(404, 'Driver location not found');
    ok(res, loc);
  } catch (err) {
    next(err);
  }
});

// PUT /api/driver-locations — driver upserts own location
router.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user.role !== 'driver') {
      throw new AppError(403, 'Only drivers can update their location');
    }

    const data = upsertLocationSchema.parse(req.body);
    const { profileId } = authReq.user;

    const loc = await queryOne<DriverLocation>(
      `INSERT INTO driver_locations (driver_id, lat, lng, heading, speed, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (driver_id) DO UPDATE
         SET lat = EXCLUDED.lat,
             lng = EXCLUDED.lng,
             heading = EXCLUDED.heading,
             speed = EXCLUDED.speed,
             updated_at = NOW()
       RETURNING *`,
      [profileId, data.lat, data.lng, data.heading ?? null, data.speed ?? null]
    );

    ok(res, loc);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/driver-locations/cleanup — admin removes stale locations (>30 days)
router.delete('/cleanup', requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `DELETE FROM driver_locations WHERE updated_at < NOW() - INTERVAL '30 days' RETURNING id`
    );
    ok(res, { deleted: result.length });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/driver-locations/:driver_id — admin
router.delete('/:driver_id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      'DELETE FROM driver_locations WHERE driver_id = $1 RETURNING id',
      [req.params.driver_id]
    );
    if (result.length === 0) throw new AppError(404, 'Driver location not found');
    noContent(res);
  } catch (err) {
    next(err);
  }
});

export default router;
