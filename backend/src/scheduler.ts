import cron from 'node-cron';
import { cleanupPhotos } from './scripts/cleanup-photos';
import { archiveStops } from './scripts/archive-stops';

// Limpieza de fotos a las 03:00 AM
cron.schedule('0 3 * * *', async () => {
  console.log('[scheduler] Ejecutando limpieza de fotos...');
  await cleanupPhotos(false).catch((err) => {
    console.error('[scheduler] Error en limpieza de fotos:', err);
  });
});

// Archivado de pedidos a las 03:30 AM (después de la limpieza de fotos)
cron.schedule('30 3 * * *', async () => {
  console.log('[scheduler] Ejecutando archivado de pedidos...');
  await archiveStops(false).catch((err) => {
    console.error('[scheduler] Error en archivado de pedidos:', err);
  });
});

console.log('[scheduler] Limpieza de fotos programada para las 03:00 AM diariamente.');
console.log('[scheduler] Archivado de pedidos programado para las 03:30 AM diariamente.');
