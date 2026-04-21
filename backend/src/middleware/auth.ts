import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { config } from '../config';
import { AuthenticatedRequest, AuthPayload } from '../types';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = header.slice(7);
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  (req as AuthenticatedRequest).user = payload as AuthPayload;
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7);
    const payload = verifyToken(token);
    if (payload) {
      (req as AuthenticatedRequest).user = payload as AuthPayload;
    }
  }
  next();
}

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-api-key'];

  if (!config.API_KEY_CREATE_ORDER) {
    res.status(503).json({ error: 'API key authentication not configured' });
    return;
  }

  if (key !== config.API_KEY_CREATE_ORDER) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  next();
}
