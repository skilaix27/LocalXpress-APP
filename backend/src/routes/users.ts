import { Router, Request, Response, NextFunction } from 'express';
import { query, queryOne, withTransaction } from '../db';
import { hashPassword } from '../utils/hash';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/roles';
import { createUserSchema, updateUserSchema } from '../utils/schemas';
import { AuthenticatedRequest, User, Profile } from '../types';
import { ok, created, noContent, parsePagination } from '../utils/response';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

// GET /api/users — list all users with profiles and roles
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, offset, page } = parsePagination(req.query as Record<string, unknown>);
    const search = req.query.search as string | undefined;

    const whereClause = search
      ? `WHERE u.email ILIKE $3 OR p.full_name ILIKE $3`
      : '';
    const params: unknown[] = [limit, offset];
    if (search) params.push(`%${search}%`);

    const [users, countResult] = await Promise.all([
      query<User & { role: string; full_name: string; profile_id: string }>(
        `SELECT u.id, u.email, u.is_active, u.created_at,
                r.role, p.full_name, p.id as profile_id, p.phone, p.shop_name, p.avatar_url
         FROM users u
         LEFT JOIN user_roles r ON r.user_id = u.id
         LEFT JOIN profiles p ON p.user_id = u.id
         ${whereClause}
         ORDER BY u.created_at DESC
         LIMIT $1 OFFSET $2`,
        params
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM users u LEFT JOIN profiles p ON p.user_id = u.id ${whereClause}`,
        search ? [`%${search}%`] : []
      ),
    ]);

    ok(res, {
      data: users,
      total: parseInt(countResult?.count ?? '0'),
      page,
      limit,
      totalPages: Math.ceil(parseInt(countResult?.count ?? '0') / limit),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/lookup-email — find user by full_name (admin only — protected unlike original)
router.get('/lookup-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const name = req.query.name as string;
    if (!name?.trim()) {
      res.status(400).json({ error: 'Query param "name" is required' });
      return;
    }
    const result = await queryOne<{ email: string }>(
      `SELECT u.email FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE p.full_name ILIKE $1
       LIMIT 1`,
      [name.trim()]
    );
    if (!result) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    ok(res, { email: result.email });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await queryOne<User & { role: string }>(
      `SELECT u.id, u.email, u.is_active, u.created_at, u.updated_at,
              r.role, p.*
       FROM users u
       LEFT JOIN user_roles r ON r.user_id = u.id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [req.params.id]
    );
    if (!user) {
      throw new AppError(404, 'User not found');
    }
    ok(res, user);
  } catch (err) {
    next(err);
  }
});

// POST /api/users — create user + profile + role
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createUserSchema.parse(req.body);
    const passwordHash = await hashPassword(data.password);

    const result = await withTransaction(async (client) => {
      const existing = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [data.email.toLowerCase()]
      );
      if (existing.rows.length > 0) {
        throw new AppError(409, 'Email already registered');
      }

      const [userRow] = await client.query(
        'INSERT INTO users (email, password_hash, is_active) VALUES ($1, $2, $3) RETURNING id, email, is_active, created_at',
        [data.email.toLowerCase(), passwordHash, data.is_active]
      );
      const newUser = userRow.rows[0] as User;

      await client.query(
        `UPDATE profiles SET full_name = $1, phone = $2, is_active = $3,
         shop_name = $4, default_pickup_address = $5, default_pickup_lat = $6, default_pickup_lng = $7
         WHERE user_id = $8`,
        [
          data.full_name,
          data.phone ?? null,
          data.is_active,
          data.shop_name ?? null,
          data.default_pickup_address ?? null,
          data.default_pickup_lat ?? null,
          data.default_pickup_lng ?? null,
          newUser.id,
        ]
      );

      await client.query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
        [newUser.id, data.role]
      );

      const profileRow = await client.query(
        'SELECT * FROM profiles WHERE user_id = $1',
        [newUser.id]
      );

      return { user: newUser, profile: profileRow.rows[0] as Profile, role: data.role };
    });

    created(res, result);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateUserSchema.parse(req.body);
    const { id } = req.params;

    const existing = await queryOne<User>('SELECT id FROM users WHERE id = $1', [id]);
    if (!existing) throw new AppError(404, 'User not found');

    await withTransaction(async (client) => {
      if (data.email !== undefined) {
        await client.query('UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2', [
          data.email.toLowerCase(),
          id,
        ]);
      }
      if (data.password !== undefined) {
        const hash = await hashPassword(data.password);
        await client.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
          hash,
          id,
        ]);
      }

      const profileFields: string[] = [];
      const profileValues: unknown[] = [];
      let idx = 1;

      const profileCols = [
        'full_name', 'phone', 'is_active', 'shop_name',
        'default_pickup_address', 'default_pickup_lat', 'default_pickup_lng',
        'iban', 'nif', 'fiscal_address', 'admin_notes',
      ] as const;

      for (const col of profileCols) {
        if (data[col as keyof typeof data] !== undefined) {
          profileFields.push(`${col} = $${idx++}`);
          profileValues.push(data[col as keyof typeof data]);
        }
      }

      if (profileFields.length > 0) {
        profileValues.push(id);
        await client.query(
          `UPDATE profiles SET ${profileFields.join(', ')}, updated_at = NOW() WHERE user_id = $${idx}`,
          profileValues
        );
      }
    });

    const updated = await queryOne(
      `SELECT u.id, u.email, u.is_active, u.updated_at, r.role, p.*
       FROM users u
       LEFT JOIN user_roles r ON r.user_id = u.id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [id]
    );

    ok(res, updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user.sub === req.params.id) {
      throw new AppError(400, 'Cannot delete your own account');
    }

    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.length === 0) throw new AppError(404, 'User not found');

    noContent(res);
  } catch (err) {
    next(err);
  }
});

export default router;
