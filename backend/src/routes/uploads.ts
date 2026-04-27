import { Router, Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { query, queryOne } from '../db';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/roles';
import { AuthenticatedRequest, Stop, OrderPhoto } from '../types';
import { ok, created, noContent } from '../utils/response';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import { cleanupPhotos } from '../scripts/cleanup-photos';

const router = Router();
router.use(requireAuth);

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Demasiadas subidas, espera un momento.' },
});

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.resolve(config.STORAGE_DIR, 'proofs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, `File type not allowed. Accepted: ${ALLOWED_MIME.join(', ')}`));
    }
  },
});

// POST /api/uploads/proof/:stop_id — driver uploads proof photo
router.post('/proof/:stop_id', uploadLimiter, upload.single('photo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user.role !== 'driver' && authReq.user.role !== 'admin') {
      throw new AppError(403, 'Only drivers or admins can upload proof photos');
    }

    if (!req.file) {
      throw new AppError(400, 'No file uploaded');
    }

    const stop = await queryOne<Stop>('SELECT * FROM stops WHERE id = $1', [req.params.stop_id]);
    if (!stop) throw new AppError(404, 'Stop not found');

    if (authReq.user.role === 'driver' && stop.driver_id !== authReq.user.profileId) {
      // clean up uploaded file before rejecting
      fs.unlinkSync(req.file.path);
      throw new AppError(403, 'This stop is not assigned to you');
    }

    const relativePath = `proofs/${req.file.filename}`;
    const publicUrl = `/uploads/${relativePath}`;

    const [photo] = await Promise.all([
      queryOne<OrderPhoto>(
        `INSERT INTO order_photos (stop_id, driver_id, file_path, file_size, mime_type)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [stop.id, authReq.user.profileId, relativePath, req.file.size, req.file.mimetype]
      ),
      query(
        'UPDATE stops SET proof_photo_url = $1, updated_at = NOW() WHERE id = $2',
        [publicUrl, stop.id]
      ),
    ]);

    created(res, { photo, url: publicUrl });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(err);
  }
});

// GET /api/uploads/proof/:stop_id — list photos for a stop
router.get('/proof/:stop_id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { role, profileId } = authReq.user;

    const stop = await queryOne<Stop>('SELECT * FROM stops WHERE id = $1', [req.params.stop_id]);
    if (!stop) throw new AppError(404, 'Stop not found');

    if (role === 'driver' && stop.driver_id !== profileId) throw new AppError(403, 'Access denied');
    if (role === 'shop' && stop.shop_id !== profileId) throw new AppError(403, 'Access denied');

    const photos = await query<OrderPhoto>(
      'SELECT * FROM order_photos WHERE stop_id = $1 ORDER BY created_at DESC',
      [req.params.stop_id]
    );

    const withUrls = photos.map((p) => ({
      ...p,
      url: `/uploads/${p.file_path}`,
    }));

    ok(res, withUrls);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/uploads/proof/:stop_id — admin deletes all photos for a stop
router.delete('/proof/:stop_id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const photos = await query<OrderPhoto>(
      'SELECT * FROM order_photos WHERE stop_id = $1',
      [req.params.stop_id]
    );

    for (const photo of photos) {
      const fullPath = path.resolve(config.STORAGE_DIR, photo.file_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    await query('DELETE FROM order_photos WHERE stop_id = $1', [req.params.stop_id]);
    await query('UPDATE stops SET proof_photo_url = NULL, updated_at = NOW() WHERE id = $1', [req.params.stop_id]);

    noContent(res);
  } catch (err) {
    next(err);
  }
});

// POST /api/uploads/cleanup — admin triggers manual photo cleanup (supports ?dry_run=true)
router.post('/cleanup', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dryRun = req.query.dry_run === 'true';
    const result = await cleanupPhotos(dryRun);
    ok(res, {
      message: dryRun ? 'Simulación completada (dry-run, no se borró nada)' : 'Limpieza completada',
      dryRun,
      ...result,
      freedMB: Number((result.freedBytes / 1024 / 1024).toFixed(2)),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
