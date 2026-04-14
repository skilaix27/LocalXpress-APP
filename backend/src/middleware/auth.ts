import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { User, Profile, AppRole } from '../types';

interface JwtPayload {
  userId: string;
  role: AppRole;
  profileId: string;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.slice(7);

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  try {
    const userResult = await pool.query<User>(
      'SELECT * FROM users WHERE id = $1 AND is_active = true',
      [payload.userId]
    );

    if (userResult.rowCount === 0) {
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }

    const profileResult = await pool.query<Profile>(
      'SELECT * FROM profiles WHERE user_id = $1',
      [payload.userId]
    );

    req.user = userResult.rows[0];
    req.profile = profileResult.rows[0] ?? undefined;
    req.role = payload.role;

    next();
  } catch (err) {
    next(err);
  }
}
