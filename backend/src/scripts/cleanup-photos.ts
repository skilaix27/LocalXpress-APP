import path from 'path';
import fs from 'fs';
import { query, queryOne } from '../db';
import { config } from '../config';

const RETENTION_DAYS = 10;

interface CleanupResult {
  deletedFiles: number;
  deletedRecords: number;
  freedBytes: number;
  errors: number;
}

async function cleanupPhotos(dryRun = false): Promise<CleanupResult> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  const mode = dryRun ? '[DRY-RUN]' : '[REAL]';
  console.log(`[photo-cleanup] ${mode} Iniciando limpieza. Eliminando fotos anteriores a ${cutoffDate.toISOString()}`);

  // Fotos en order_photos más antiguas que el cutoff
  const oldPhotos = await query<{ id: string; file_path: string; stop_id: string; file_size: number | null }>(
    `SELECT id, file_path, stop_id, file_size
     FROM order_photos
     WHERE created_at < $1`,
    [cutoffDate.toISOString()]
  );

  // Stops con proof_photo_url antigua (basado en delivered_at)
  const oldProofs = await query<{ id: string; proof_photo_url: string }>(
    `SELECT id, proof_photo_url
     FROM stops
     WHERE proof_photo_url IS NOT NULL
       AND delivered_at < $1`,
    [cutoffDate.toISOString()]
  );

  console.log(`[photo-cleanup] ${mode} order_photos a limpiar: ${oldPhotos.length}`);
  console.log(`[photo-cleanup] ${mode} stops con proof_photo_url antiguo: ${oldProofs.length}`);

  const uploadDir = path.resolve(config.STORAGE_DIR);
  let deletedFiles = 0;
  let deletedRecords = 0;
  let freedBytes = 0;
  let errors = 0;

  // Limpiar order_photos
  for (const photo of oldPhotos) {
    try {
      const filePath = path.resolve(uploadDir, photo.file_path);
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        freedBytes += stat.size;
        if (!dryRun) {
          fs.unlinkSync(filePath);
        }
        deletedFiles++;
        console.log(`[photo-cleanup] ${mode} Archivo: ${filePath} (${(stat.size / 1024).toFixed(1)} KB)`);
      }
      if (!dryRun) {
        await query('DELETE FROM order_photos WHERE id = $1', [photo.id]);
      }
      deletedRecords++;
    } catch (err) {
      errors++;
      console.error(`[photo-cleanup] Error en order_photo ${photo.id}:`, err);
    }
  }

  // Limpiar proof_photo_url en stops
  for (const stop of oldProofs) {
    try {
      // proof_photo_url tiene formato /uploads/proofs/filename.jpg
      const relativePath = stop.proof_photo_url.replace(/^\/uploads\//, '');
      const filePath = path.resolve(uploadDir, relativePath);

      if (fs.existsSync(filePath)) {
        // Evitar doble conteo si el archivo ya fue procesado desde order_photos
        const alreadyCounted = oldPhotos.some((p) => path.resolve(uploadDir, p.file_path) === filePath);
        if (!alreadyCounted) {
          const stat = fs.statSync(filePath);
          freedBytes += stat.size;
          if (!dryRun) {
            fs.unlinkSync(filePath);
          }
          deletedFiles++;
          console.log(`[photo-cleanup] ${mode} Proof: ${filePath} (${(stat.size / 1024).toFixed(1)} KB)`);
        }
      }
      if (!dryRun) {
        await query(
          `UPDATE stops SET proof_photo_url = NULL, updated_at = NOW() WHERE id = $1`,
          [stop.id]
        );
      }
      deletedRecords++;
    } catch (err) {
      errors++;
      console.error(`[photo-cleanup] Error en stop ${stop.id}:`, err);
    }
  }

  const freedMB = (freedBytes / 1024 / 1024).toFixed(2);
  console.log(
    `[photo-cleanup] ${mode} Completado. ` +
    `Archivos eliminados: ${deletedFiles}, ` +
    `Registros procesados: ${deletedRecords}, ` +
    `Espacio liberado: ${freedMB} MB, ` +
    `Errores: ${errors}`
  );

  return { deletedFiles, deletedRecords, freedBytes, errors };
}

// Ejecutar directamente: npx tsx src/scripts/cleanup-photos.ts [--dry-run]
if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  cleanupPhotos(dryRun)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[photo-cleanup] Error fatal:', err);
      process.exit(1);
    });
}

export { cleanupPhotos };
