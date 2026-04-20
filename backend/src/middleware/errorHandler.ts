import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from '../config';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // PostgreSQL unique violation
  if ((err as NodeJS.ErrnoException).code === '23505') {
    res.status(409).json({ error: 'Resource already exists (unique constraint)' });
    return;
  }

  // PostgreSQL foreign key violation
  if ((err as NodeJS.ErrnoException).code === '23503') {
    res.status(400).json({ error: 'Referenced resource does not exist' });
    return;
  }

  console.error(`[${req.method}] ${req.path}`, err);

  res.status(500).json({
    error: 'Internal server error',
    ...(config.NODE_ENV === 'development' ? { message: err.message, stack: err.stack } : {}),
  });
}
