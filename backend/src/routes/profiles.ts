import { Router, Request, Response, NextFunction } from 'express';
import { query, queryOne } from '../db';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/roles';
import { updateProfileSchema } from '../utils/schemas';
import { AuthenticatedRequest, Profile } from '../types';
import { ok } from '../utils/response';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(requireAuth);

// GET /api/profiles/me
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const profile = await queryOne<Profile>(
      'SELECT * FROM profiles WHERE user_id = $1',
      [authReq.user.sub]
    );
    if (!profile) throw new AppError(404, 'Profile not found');
    ok(res, profile);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/profiles/me
router.patch('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const data = updateProfileSchema.parse(req.body);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }

    if (fields.length === 0) {
      throw new AppError(400, 'No fields to update');
    }

    values.push(authReq.user.sub);
    const updated = await queryOne<Profile>(
      `UPDATE profiles SET ${fields.join(', ')}, updated_at = NOW()
       WHERE user_id = $${idx}
       RETURNING *`,
      values
    );

    ok(res, updated);
  } catch (err) {
    next(err);
  }
});

// GET /api/profiles/:id — admin only
router.get('/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await queryOne<Profile & { email: string; role: string }>(
      `SELECT p.*, u.email, r.role
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN user_roles r ON r.user_id = p.user_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!profile) throw new AppError(404, 'Profile not found');
    ok(res, profile);
  } catch (err) {
    next(err);
  }
});

// GET /api/profiles — list all profiles (admin only)
router.get('/', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.query.role as string | undefined;
    const params: unknown[] = [];
    let where = '';

    if (role) {
      where = 'WHERE r.role = $1';
      params.push(role);
    }

    const profiles = await query<Profile & { email: string; role: string }>(
      `SELECT p.*, u.email, r.role
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN user_roles r ON r.user_id = p.user_id
       ${where}
       ORDER BY p.full_name ASC`,
      params
    );

    ok(res, profiles);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/profiles/:id — admin only
router.patch('/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateProfileSchema.parse(req.body);

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
    const updated = await queryOne<Profile>(
      `UPDATE profiles SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${idx}
       RETURNING *`,
      values
    );

    if (!updated) throw new AppError(404, 'Profile not found');
    ok(res, updated);
  } catch (err) {
    next(err);
  }
});

export default router;
