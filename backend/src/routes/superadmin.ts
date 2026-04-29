import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { query, queryOne } from '../db';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/roles';
import { ok } from '../utils/response';
import { config } from '../config';

const router = Router();
router.use(requireAuth, requireAdmin);

// GET /api/superadmin/metrics — métricas globales del sistema
router.get('/metrics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      userStats,
      activeStopsByStatus,
      archivedCount,
      stopsToday,
      stopsThisWeek,
      stopsThisMonth,
      revenueStats,
      pendingPayments,
      photoStats,
      lastActivity,
    ] = await Promise.all([
      // Usuarios: total, activos, por rol
      queryOne<{
        total_users: string;
        active_users: string;
        total_admins: string;
        total_shops: string;
        total_drivers: string;
      }>(
        `SELECT
           COUNT(DISTINCT u.id)::text AS total_users,
           COUNT(DISTINCT u.id) FILTER (WHERE u.is_active = true)::text AS active_users,
           COUNT(DISTINCT u.id) FILTER (WHERE ur.role = 'admin')::text AS total_admins,
           COUNT(DISTINCT u.id) FILTER (WHERE ur.role = 'shop')::text AS total_shops,
           COUNT(DISTINCT u.id) FILTER (WHERE ur.role = 'driver')::text AS total_drivers
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id`
      ),

      // Stops activos por estado
      query<{ status: string; count: string }>(
        `SELECT status::text, COUNT(*)::text AS count FROM stops GROUP BY status`
      ),

      // Stops archivados
      queryOne<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM stops_archive`
      ),

      // Stops creados hoy (activos + archivados)
      queryOne<{ count: string }>(
        `SELECT (
           (SELECT COUNT(*) FROM stops WHERE created_at >= CURRENT_DATE) +
           (SELECT COUNT(*) FROM stops_archive WHERE created_at >= CURRENT_DATE)
         )::text AS count`
      ),

      // Stops creados esta semana
      queryOne<{ count: string }>(
        `SELECT (
           (SELECT COUNT(*) FROM stops WHERE created_at >= date_trunc('week', CURRENT_DATE)) +
           (SELECT COUNT(*) FROM stops_archive WHERE created_at >= date_trunc('week', CURRENT_DATE))
         )::text AS count`
      ),

      // Stops creados este mes
      queryOne<{ count: string }>(
        `SELECT (
           (SELECT COUNT(*) FROM stops WHERE created_at >= date_trunc('month', CURRENT_DATE)) +
           (SELECT COUNT(*) FROM stops_archive WHERE created_at >= date_trunc('month', CURRENT_DATE))
         )::text AS count`
      ),

      // Ingresos: hoy y este mes (activos + archivados con status delivered)
      queryOne<{
        revenue_today: string;
        revenue_this_month: string;
        total_paid_by_clients: string;
        total_paid_to_drivers: string;
      }>(
        `SELECT
           COALESCE(
             (SELECT SUM(price) FROM stops WHERE status = 'delivered' AND delivered_at >= CURRENT_DATE) +
             (SELECT SUM(price) FROM stops_archive WHERE delivered_at >= CURRENT_DATE), 0
           )::text AS revenue_today,
           COALESCE(
             (SELECT SUM(price) FROM stops WHERE status = 'delivered' AND delivered_at >= date_trunc('month', CURRENT_DATE)) +
             (SELECT SUM(price) FROM stops_archive WHERE delivered_at >= date_trunc('month', CURRENT_DATE)), 0
           )::text AS revenue_this_month,
           COALESCE(
             (SELECT SUM(price) FROM stops WHERE paid_by_client = true) +
             (SELECT SUM(price) FROM stops_archive WHERE paid_by_client = true), 0
           )::text AS total_paid_by_clients,
           COALESCE(
             (SELECT SUM(price_driver) FROM stops WHERE paid_to_driver = true) +
             (SELECT SUM(price_driver) FROM stops_archive WHERE paid_to_driver = true), 0
           )::text AS total_paid_to_drivers`
      ),

      // Pagos pendientes
      queryOne<{
        total_pending_client_payment: string;
        total_pending_driver_payment: string;
        estimated_company_margin: string;
      }>(
        `SELECT
           COALESCE(
             (SELECT SUM(price) FROM stops WHERE status = 'delivered' AND paid_by_client = false) +
             (SELECT SUM(price) FROM stops_archive WHERE paid_by_client = false), 0
           )::text AS total_pending_client_payment,
           COALESCE(
             (SELECT SUM(price_driver) FROM stops WHERE status = 'delivered' AND paid_to_driver = false AND driver_id IS NOT NULL) +
             (SELECT SUM(price_driver) FROM stops_archive WHERE paid_to_driver = false AND driver_id IS NOT NULL), 0
           )::text AS total_pending_driver_payment,
           COALESCE(
             (SELECT SUM(price_company) FROM stops WHERE status = 'delivered') +
             (SELECT SUM(price_company) FROM stops_archive), 0
           )::text AS estimated_company_margin`
      ),

      // Fotos
      queryOne<{
        total_photos: string;
        total_photo_size_bytes: string;
        latest_photo_created_at: string | null;
      }>(
        `SELECT
           COUNT(*)::text AS total_photos,
           COALESCE(SUM(file_size), 0)::text AS total_photo_size_bytes,
           MAX(created_at)::text AS latest_photo_created_at
         FROM order_photos`
      ),

      // Última actividad
      queryOne<{
        last_stop_created_at: string | null;
        last_user_created_at: string | null;
      }>(
        `SELECT
           (SELECT MAX(created_at)::text FROM stops) AS last_stop_created_at,
           (SELECT MAX(created_at)::text FROM users) AS last_user_created_at`
      ),
    ]);

    // Construir byStatus desde el array de stops activos
    const byStatus = Object.fromEntries(
      (activeStopsByStatus as { status: string; count: string }[]).map((r) => [
        r.status,
        parseInt(r.count),
      ])
    );

    const totalActiveStops = Object.values(byStatus).reduce((a, b) => a + b, 0);

    // Tamaño real de fotos en disco (complementa la suma de file_size en DB)
    const photoSizeBytes = parseInt(photoStats?.total_photo_size_bytes ?? '0');

    ok(res, {
      users: {
        total_users: parseInt(userStats?.total_users ?? '0'),
        active_users: parseInt(userStats?.active_users ?? '0'),
        total_admins: parseInt(userStats?.total_admins ?? '0'),
        total_shops: parseInt(userStats?.total_shops ?? '0'),
        total_drivers: parseInt(userStats?.total_drivers ?? '0'),
      },
      stops: {
        total_active_stops: totalActiveStops,
        total_archived_stops: parseInt(archivedCount?.count ?? '0'),
        stops_today: parseInt(stopsToday?.count ?? '0'),
        stops_this_week: parseInt(stopsThisWeek?.count ?? '0'),
        stops_this_month: parseInt(stopsThisMonth?.count ?? '0'),
        pending_stops: byStatus['pending'] ?? 0,
        assigned_stops: byStatus['assigned'] ?? 0,
        picked_stops: byStatus['picked'] ?? 0,
        delivered_stops: byStatus['delivered'] ?? 0,
        cancelled_stops: byStatus['cancelled'] ?? 0,
      },
      finances: {
        revenue_today: parseFloat(revenueStats?.revenue_today ?? '0'),
        revenue_this_month: parseFloat(revenueStats?.revenue_this_month ?? '0'),
        total_pending_client_payment: parseFloat(pendingPayments?.total_pending_client_payment ?? '0'),
        total_pending_driver_payment: parseFloat(pendingPayments?.total_pending_driver_payment ?? '0'),
        total_paid_by_clients: parseFloat(revenueStats?.total_paid_by_clients ?? '0'),
        total_paid_to_drivers: parseFloat(revenueStats?.total_paid_to_drivers ?? '0'),
        estimated_company_margin: parseFloat(pendingPayments?.estimated_company_margin ?? '0'),
      },
      photos: {
        total_photos: parseInt(photoStats?.total_photos ?? '0'),
        total_photo_size_bytes: photoSizeBytes,
        total_photo_size_mb: Number((photoSizeBytes / 1024 / 1024).toFixed(2)),
        latest_photo_created_at: photoStats?.latest_photo_created_at ?? null,
      },
      activity: {
        last_stop_created_at: lastActivity?.last_stop_created_at ?? null,
        last_user_created_at: lastActivity?.last_user_created_at ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
