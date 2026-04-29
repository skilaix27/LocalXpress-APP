import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { query, queryOne, withTransaction } from '../db';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/roles';
import { ok, parsePagination } from '../utils/response';
import { AppError } from '../middleware/errorHandler';
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

// ─── Shared stops filter builder ──────────────────────────────────────────────

interface StopsFilterResult {
  where: string;
  params: unknown[];
  nextIdx: number;
}

function buildStopsWhere(q: Record<string, string | undefined>): StopsFilterResult {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (q.status && q.status !== 'all') {
    conditions.push(`s.status::text = $${idx++}`);
    params.push(q.status);
  }
  if (q.date_from) { conditions.push(`COALESCE(s.scheduled_pickup_at, s.created_at) >= $${idx++}`); params.push(q.date_from); }
  if (q.date_to)   { conditions.push(`COALESCE(s.scheduled_pickup_at, s.created_at) <= $${idx++}`); params.push(q.date_to); }
  if (q.shop_id)   { conditions.push(`s.shop_id = $${idx++}::uuid`); params.push(q.shop_id); }
  if (q.driver_id) { conditions.push(`s.driver_id = $${idx++}::uuid`); params.push(q.driver_id); }
  if (q.paid_by_client === 'true')  { conditions.push(`s.paid_by_client = $${idx++}`); params.push(true); }
  else if (q.paid_by_client === 'false') { conditions.push(`s.paid_by_client = $${idx++}`); params.push(false); }
  if (q.paid_to_driver === 'true')  { conditions.push(`s.paid_to_driver = $${idx++}`); params.push(true); }
  else if (q.paid_to_driver === 'false') { conditions.push(`s.paid_to_driver = $${idx++}`); params.push(false); }
  if (q.search?.trim()) {
    const like = `%${q.search.trim()}%`;
    conditions.push(
      `(s.order_code ILIKE $${idx} OR s.client_name ILIKE $${idx} OR s.client_phone ILIKE $${idx}` +
      ` OR s.pickup_address ILIKE $${idx} OR s.delivery_address ILIKE $${idx}` +
      ` OR s.shop_name ILIKE $${idx} OR dp.full_name ILIKE $${idx})`
    );
    params.push(like);
    idx++;
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
    nextIdx: idx,
  };
}

const STOPS_SELECT_COLS = `
  s.id, s.order_code, s.status::text AS status,
  s.client_name, s.client_phone,
  s.pickup_address, s.delivery_address,
  s.shop_name, s.shop_id::text, s.driver_id::text,
  COALESCE(dp.full_name, '') AS driver_name,
  s.distance_km, s.price, s.price_driver, s.price_company,
  s.paid_by_client, s.paid_to_driver,
  s.created_at, s.scheduled_pickup_at, s.delivered_at`;

function buildStopsSource(archived: string | undefined, where: string): string {
  const active   = `SELECT ${STOPS_SELECT_COLS}, false AS is_archived
                    FROM stops s LEFT JOIN profiles dp ON s.driver_id = dp.id ${where}`;
  const archived_ = `SELECT ${STOPS_SELECT_COLS}, true AS is_archived
                    FROM stops_archive s LEFT JOIN profiles dp ON s.driver_id = dp.id ${where}`;
  if (archived === 'true')  return archived_;
  if (archived === 'all')   return `${active} UNION ALL ${archived_}`;
  return active; // default: active only
}

// GET /api/superadmin/stops — pedidos globales con filtros y paginación
router.get('/stops', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, offset, page } = parsePagination(req.query as Record<string, unknown>);
    const q = req.query as Record<string, string | undefined>;
    const { where, params, nextIdx } = buildStopsWhere(q);
    const source = buildStopsSource(q.archived, where);

    const paginationParams = [...params, limit, offset];
    const limitIdx  = nextIdx;
    const offsetIdx = nextIdx + 1;

    const [rows, summary] = await Promise.all([
      query(
        `SELECT * FROM (${source}) AS combined
         ORDER BY created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        paginationParams
      ),
      queryOne<{ total: string; total_price: string; total_price_driver: string }>(
        `SELECT
           COUNT(*)::text AS total,
           COALESCE(SUM(price), 0)::text AS total_price,
           COALESCE(SUM(COALESCE(price_driver, price * 0.70)), 0)::text AS total_price_driver
         FROM (${source}) AS combined`,
        params
      ),
    ]);

    const total = parseInt(summary?.total ?? '0');

    ok(res, {
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        total_price: parseFloat(summary?.total_price ?? '0'),
        total_price_driver: parseFloat(summary?.total_price_driver ?? '0'),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/superadmin/export/stops — descarga CSV con los mismos filtros
router.get('/export/stops', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const { where, params, nextIdx } = buildStopsWhere(q);
    const source = buildStopsSource(q.archived, where);

    // Load pricing zones to compute zone name for each row
    const MARGIN_KM = 0.15;
    const pricingZones = await query<{
      name: string; min_km: number; max_km: number | null;
      fixed_price: number | null; per_km_price: number | null;
    }>('SELECT name, min_km, max_km, fixed_price, per_km_price FROM pricing_zones ORDER BY sort_order ASC, min_km ASC');

    function resolveZoneName(distanceKm: unknown): string {
      if (distanceKm == null || typeof distanceKm !== 'number') return '';
      const adjusted = distanceKm + MARGIN_KM;
      for (const z of pricingZones) {
        if (adjusted > z.min_km && (z.max_km == null || adjusted <= z.max_km)) return z.name;
      }
      return pricingZones.length ? pricingZones[pricingZones.length - 1].name : '';
    }

    const rows = await query(
      `SELECT * FROM (${source}) AS combined
       ORDER BY created_at DESC
       LIMIT $${nextIdx}`,
      [...params, 5000]
    ) as Record<string, unknown>[];

    const headers = [
      'Referencia', 'Estado', 'Tienda', 'Repartidor',
      'Cliente', 'Teléfono', 'Recogida', 'Entrega',
      'Distancia km', 'Zona', 'Precio €', 'Precio repartidor €', 'Margen empresa €',
      'Cobrado cliente', 'Pagado repartidor',
      'Creado', 'Programado', 'Entregado', 'Archivado',
    ];

    const csvRows = rows.map((r) => [
      r.order_code ?? '',
      r.status ?? '',
      r.shop_name ?? '',
      r.driver_name ?? '',
      r.client_name ?? '',
      r.client_phone ?? '',
      `"${String(r.pickup_address ?? '').replace(/"/g, '""')}"`,
      `"${String(r.delivery_address ?? '').replace(/"/g, '""')}"`,
      r.distance_km != null ? Number(r.distance_km).toFixed(1) : '',
      resolveZoneName(r.distance_km),
      r.price ?? '',
      r.price_driver != null ? r.price_driver : (r.price != null ? Math.round(Number(r.price) * 0.70 * 100) / 100 : ''),
      r.price_company != null ? r.price_company : (r.price != null ? Math.round((Number(r.price) - Math.round(Number(r.price) * 0.70 * 100) / 100) * 100) / 100 : ''),
      r.paid_by_client ? 'Sí' : 'No',
      r.paid_to_driver ? 'Sí' : 'No',
      r.created_at ? new Date(r.created_at as string).toISOString() : '',
      r.scheduled_pickup_at ? new Date(r.scheduled_pickup_at as string).toISOString() : '',
      r.delivered_at ? new Date(r.delivered_at as string).toISOString() : '',
      r.is_archived ? 'Sí' : 'No',
    ].join(','));

    const csv = '\uFEFF' + [headers.join(','), ...csvRows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pedidos-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/superadmin/stops/payments — bulk payment status update
router.patch('/stops/payments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stop_ids, action } = req.body as { stop_ids: unknown; action: unknown };

    const validActions = ['mark_client_paid', 'mark_client_unpaid', 'mark_driver_paid', 'mark_driver_unpaid'];

    if (!Array.isArray(stop_ids) || stop_ids.length === 0)
      throw new AppError(400, 'stop_ids must be a non-empty array');
    if (stop_ids.length > 100)
      throw new AppError(400, 'Maximum 100 stops per request');
    if (typeof action !== 'string' || !validActions.includes(action))
      throw new AppError(400, `Invalid action. Must be one of: ${validActions.join(', ')}`);

    const fieldMap: Record<string, string> = {
      mark_client_paid:    'paid_by_client = true',
      mark_client_unpaid:  'paid_by_client = false',
      mark_driver_paid:    'paid_to_driver = true',
      mark_driver_unpaid:  'paid_to_driver = false',
    };

    const updated = await withTransaction(async (client) => {
      const placeholders = (stop_ids as unknown[]).map((_: unknown, i: number) => `$${i + 1}`).join(', ');
      const result = await client.query(
        `UPDATE stops SET ${fieldMap[action as string]}, updated_at = NOW()
         WHERE id::text = ANY(ARRAY[${placeholders}])
         RETURNING id`,
        stop_ids as unknown[]
      );
      return result.rowCount ?? 0;
    });

    ok(res, { updated });
  } catch (err) {
    next(err);
  }
});

export default router;

