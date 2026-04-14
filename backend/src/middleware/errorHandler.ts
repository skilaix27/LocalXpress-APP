import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[errorHandler]', err);

  if (err instanceof Error) {
    // Zod validation errors have a specific shape
    const anyErr = err as unknown as Record<string, unknown>;
    if (anyErr['name'] === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: anyErr['errors'] });
      return;
    }

    // PostgreSQL unique violation
    if (anyErr['code'] === '23505') {
      res.status(409).json({ error: 'Duplicate entry', detail: anyErr['detail'] });
      return;
    }

    res.status(500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}
