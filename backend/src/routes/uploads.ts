import { Router, Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import rateLimit from 'express-rate-limit';
import sharp from 'sharp';
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

// Memory storage — file processed by sharp before writing to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, `File type not allowed. Accepted: ${ALLOWED_MIME.join(', ')}`));
    }
  },
});

// POST /api/uploads/proof/:stop_id — driver uploads proof photo (compressed via sharp)
router.post('/proof/:stop_id', uploadLimiter, upload.single('photo'), async (req: Request, res: Response, next: NextFunction) => {
  let finalPath: string | null = null;
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
      throw new AppError(403, 'This stop is not assigned to you');
    }

    // Ensure proofs directory exists
    const proofsDir = path.resolve(config.STORAGE_DIR, 'proofs');
    if (!fs.existsSync(proofsDir)) fs.mkdirSync(proofsDir, { recursive: true });

    // Generate final filename (always .jpg after compression)
    const finalName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    finalPath = path.join(proofsDir, finalName);

    // Compress with sharp: auto-rotate (EXIF), max 1600px, JPEG quality 78, strip metadata
    let compressedBuffer: Buffer;
    try {
      compressedBuffer = await sharp(req.file.buffer)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 78 })
        .toBuffer();
    } catch (sharpErr) {
      console.error('[uploads] sharp compression failed:', sharpErr);
      throw new AppError(500, 'Error al procesar la imagen. Inténtalo de nuevo.');
    }

    fs.writeFileSync(finalPath, compressedBuffer);
    const fileSize = compressedBuffer.length;

    const relativePath = `proofs/${finalName}`;
    const publicUrl = `/uploads/${relativePath}`;

    const [photo] = await Promise.all([
      queryOne<OrderPhoto>(
        `INSERT INTO order_photos (stop_id, driver_id, file_path, file_size, mime_type)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [stop.id, authReq.user.profileId, relativePath, fileSize, 'image/jpeg']
      ),
      query(
        'UPDATE stops SET proof_photo_url = $1, updated_at = NOW() WHERE id = $2',
        [publicUrl, stop.id]
      ),
    ]);

    console.log(`[uploads] Foto comprimida: ${(req.file.size / 1024).toFixed(0)}KB → ${(fileSize / 1024).toFixed(0)}KB (${finalName})`);
    created(res, { photo, url: publicUrl });
  } catch (err) {
    // Clean up file if it was partially written
    if (finalPath && fs.existsSync(finalPath)) {
      fs.unlinkSync(finalPath);
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
