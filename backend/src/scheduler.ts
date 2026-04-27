import cron from 'node-cron';
import { cleanupPhotos } from './scripts/cleanup-photos';

// Limpieza de fotos cada día a las 03:00 AM (hora del servidor)
cron.schedule('0 3 * * *', async () => {
  console.log('[scheduler] Ejecutando limpieza de fotos...');
  await cleanupPhotos(false).catch((err) => {
    console.error('[scheduler] Error en limpieza de fotos:', err);
  });
});

console.log('[scheduler] Limpieza de fotos programada para las 03:00 AM diariamente.');
