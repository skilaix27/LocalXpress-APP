import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import pool from '../db';
import { authMiddleware } from '../middleware/auth';
import { User, Profile, AppRole } from '../types';

const router = Router();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function signToken(userId: string, role: AppRole, profileId: string): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? '7d') as `${number}${'s' | 'm' | 'h' | 'd' | 'w' | 'y'}`;
  return jwt.sign(
    { userId, role, profileId },
    process.env.JWT_SECRET as string,
    { expiresIn }
  );
}

function safeUser(user: User) {
  const { password_hash: _ph, ...safe } = user;
  return safe;
}

// ─── POST /login ─────────────────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    const userResult = await pool.query<User>(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email.toLowerCase().trim()]
    );

    if (userResult.rowCount === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = userResult.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const profileResult = await pool.query<Profile>(
      'SELECT * FROM profiles WHERE user_id = $1',
      [user.id]
    );

    const profile = profileResult.rows[0] ?? null;
    const token = signToken(user.id, user.role, profile?.id ?? '');

    res.json({
      token,
      user: safeUser(user),
      profile,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /me ─────────────────────────────────────────────────────────────────

router.get('/me', authMiddleware, (req: Request, res: Response) => {
  res.json({
    user: safeUser(req.user!),
    profile: req.profile ?? null,
  });
});

// ─── PUT /password ────────────────────────────────────────────────────────────

router.put('/password', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = ChangePasswordSchema.parse(req.body);

    const userResult = await pool.query<User>(
      'SELECT * FROM users WHERE id = $1',
      [req.user!.id]
    );

    const user = userResult.rows[0];
    const valid = await bcrypt.compare(currentPassword, user.password_hash);

    if (!valid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, user.id]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── POST /accept-privacy ─────────────────────────────────────────────────────

router.post('/accept-privacy', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await pool.query(
      'UPDATE profiles SET privacy_accepted_at = NOW(), updated_at = NOW() WHERE user_id = $1',
      [req.user!.id]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
