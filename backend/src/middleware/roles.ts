import { Request, Response, NextFunction } from 'express';
import { AppRole, AuthenticatedRequest } from '../types';

export function requireRole(...roles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        actual: user.role,
      });
      return;
    }
    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireRole('admin')(req, res, next);
}

export function requireAdminOrShop(req: Request, res: Response, next: NextFunction): void {
  requireRole('admin', 'shop')(req, res, next);
}
