import { Request, Response, NextFunction } from 'express';
import { AppRole } from '../types';

export function requireRole(...roles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.role || !roles.includes(req.role)) {
      res.status(403).json({
        error: `Forbidden: requires one of [${roles.join(', ')}]`,
      });
      return;
    }
    next();
  };
}
