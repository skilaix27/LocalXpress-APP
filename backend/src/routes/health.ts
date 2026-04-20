import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT NOW() as time, version() as pg_version');
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        time: result.rows[0].time,
        version: result.rows[0].pg_version,
      },
      uptime: process.uptime(),
    });
  } catch {
    res.status(503).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      database: { connected: false },
    });
  }
});

export default router;
