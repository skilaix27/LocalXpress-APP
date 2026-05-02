import path from 'path';
import fs from 'fs';
import { pool, withTransaction } from '../db';
import { config } from '../config';

const ARCHIVE_DAYS = 32;

interface ArchiveResult {
  archived: number;
  photosDeleted: number;
  errors: number;
}

interface StopRow {
  id: string;
  order_code: string | null;
  proof_photo_url: string | null;
}

async function archiveStops(dryRun = false): Promise<ArchiveResult> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ARCHIVE_DAYS);

  const mode = dryRun ? '[DRY-RUN]' : '[REAL]';
  console.log(`[archive-stops] ${mode} Iniciando archivado. Cutoff: ${cutoff.toISOString()}`);

  // Find candidates — any stop created more than 32 days ago
  const client = await pool.connect();
  let candidates: StopRow[] = [];
  try {
    const result = await client.query<StopRow>(
      `SELECT id, order_code, proof_photo_url
       FROM stops
       WHERE created_at < $1`,
      [cutoff.toISOString()]
    );
    candidates = result.rows;
  } finally {
    client.release();
  }

  if (candidates.length === 0) {
    console.log('[archive-stops] No hay pedidos para archivar.');
    return { archived: 0, photosDeleted: 0, errors: 0 };
  }

  console.log(`[archive-stops] ${mode} Pedidos a archivar: ${candidates.length}`);
  candidates.slice(0, 10).forEach((s) => {
    console.log(`  - ${s.order_code ?? s.id}${s.proof_photo_url ? ' (tiene proof_photo_url)' : ''}`);
  });
  if (candidates.length > 10) {
    console.log(`  ... y ${candidates.length - 10} más`);
  }

  if (dryRun) {
    console.log('[archive-stops] DRY-RUN: no se ha modificado nada.');
    return { archived: candidates.length, photosDeleted: 0, errors: 0 };
  }

  // Delete any leftover proof photo files (should already be gone at 10 days)
  const uploadDir = path.resolve(config.STORAGE_DIR);
  let photosDeleted = 0;
  for (const stop of candidates) {
    if (!stop.proof_photo_url) continue;
    try {
      const relativePath = stop.proof_photo_url.replace(/^\/uploads\//, '');
      const filePath = path.resolve(uploadDir, relativePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        photosDeleted++;
        console.log(`[archive-stops] Foto residual eliminada: ${filePath}`);
      }
    } catch (err) {
      console.error(`[archive-stops] Error eliminando foto de stop ${stop.id}:`, err);
    }
  }

  // Atomic transaction: copy to archive, then delete from stops
  let archived = 0;
  let errors = 0;
  try {
    await withTransaction(async (txClient) => {
      // Insert into stops_archive with explicit columns (proof_photo_url always NULL)
      await txClient.query(
        `INSERT INTO stops_archive
           (id, order_code,
            pickup_address, pickup_lat, pickup_lng,
            delivery_address, delivery_lat, delivery_lng,
            client_name, client_phone, client_notes,
            driver_id, shop_id, created_by,
            status, package_size,
            distance_km, price, price_driver, price_company,
            paid_by_client, paid_by_client_at,
            paid_to_driver, paid_to_driver_at,
            proof_photo_url, shop_name,
            scheduled_pickup_at, picked_at, delivered_at,
            created_at, updated_at, archived_at,
            source, email_from, email_subject,
            order_type, payment_status,
            stripe_checkout_session_id, stripe_payment_intent_id,
            customer_email, customer_full_name, customer_phone)
         SELECT
           id, order_code,
           pickup_address, pickup_lat, pickup_lng,
           delivery_address, delivery_lat, delivery_lng,
           client_name, client_phone, client_notes,
           driver_id, shop_id, created_by,
           status::TEXT, package_size::TEXT,
           distance_km, price, price_driver, price_company,
           paid_by_client, paid_by_client_at,
           paid_to_driver, paid_to_driver_at,
           NULL AS proof_photo_url, shop_name,
           scheduled_pickup_at, picked_at, delivered_at,
           created_at, updated_at, NOW(),
           COALESCE(source, 'app'), email_from, email_subject,
           COALESCE(order_type, 'business'), COALESCE(payment_status, 'unpaid'),
           stripe_checkout_session_id, stripe_payment_intent_id,
           customer_email, customer_full_name, customer_phone
         FROM stops
         WHERE created_at < $1
         ON CONFLICT (id) DO NOTHING`,
        [cutoff.toISOString()]
      );

      // Delete from stops — order_photos will CASCADE automatically
      const del = await txClient.query(
        `DELETE FROM stops WHERE created_at < $1`,
        [cutoff.toISOString()]
      );
      archived = del.rowCount ?? 0;
    });

    console.log(`[archive-stops] Completado. Archivados: ${archived}, Fotos residuales eliminadas: ${photosDeleted}`);
  } catch (err) {
    errors++;
    console.error('[archive-stops] Error durante la transacción:', err);
    throw err;
  }

  return { archived, photosDeleted, errors };
}

// Ejecutar directamente: npx tsx src/scripts/archive-stops.ts [--dry-run]
if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  archiveStops(dryRun)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[archive-stops] Error fatal:', err);
      process.exit(1);
    });
}

export { archiveStops };
