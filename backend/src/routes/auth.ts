import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { query, queryOne } from '../db';
import { comparePassword } from '../utils/hash';
import { signToken } from '../utils/jwt';
import { loginSchema } from '../utils/schemas';
import { requireAuth } from '../middleware/auth';
import { AuthenticatedRequest, User, Profile, UserRole } from '../types';
import { ok } from '../utils/response';

const router = Router();

// 10 failed attempts per 15 min per IP+email combination
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = (req.body?.email as string | undefined)?.toLowerCase() ?? '';
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    return `${ip}:${email}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Espera unos minutos y vuelve a intentarlo.' },
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await queryOne<User & { password_hash: string }>(
      'SELECT id, email, password_hash, is_active FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (!user || !user.is_active) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const [profile, roleRow] = await Promise.all([
      queryOne<Profile>('SELECT * FROM profiles WHERE user_id = $1', [user.id]),
      queryOne<UserRole>('SELECT role FROM user_roles WHERE user_id = $1', [user.id]),
    ]);

    if (!profile || !roleRow) {
      res.status(500).json({ error: 'User profile or role not found' });
      return;
    }

    const token = signToken({
      sub: user.id,
      role: roleRow.role,
      profileId: profile.id,
      email: user.email,
    });

    await query(
      'UPDATE users SET updated_at = NOW() WHERE id = $1',
      [user.id]
    );

    ok(res, {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: roleRow.role,
        profile: {
          id: profile.id,
          full_name: profile.full_name,
          phone: profile.phone,
          avatar_url: profile.avatar_url,
          shop_name: profile.shop_name,
          default_pickup_address: profile.default_pickup_address,
          default_pickup_lat: profile.default_pickup_lat,
          default_pickup_lng: profile.default_pickup_lng,
          privacy_accepted_at: profile.privacy_accepted_at,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.sub;

    const user = await queryOne<User>(
      'SELECT id, email, is_active, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (!user || !user.is_active) {
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }

    const [profile, roleRow] = await Promise.all([
      queryOne<Profile>('SELECT * FROM profiles WHERE user_id = $1', [userId]),
      queryOne<UserRole>('SELECT role FROM user_roles WHERE user_id = $1', [userId]),
    ]);

    ok(res, {
      id: user.id,
      email: user.email,
      is_active: user.is_active,
      role: roleRow?.role ?? null,
      profile: profile ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh — simple re-issue using current valid token
router.post('/refresh', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { sub, role, profileId, email } = authReq.user;

    const user = await queryOne<{ is_active: boolean }>(
      'SELECT is_active FROM users WHERE id = $1',
      [sub]
    );
    if (!user?.is_active) {
      res.status(401).json({ error: 'Account inactive' });
      return;
    }

    const token = signToken({ sub, role, profileId, email });
    ok(res, { token });
  } catch (err) {
    next(err);
  }
});

export default router;
