-- Performance indexes — safe, non-blocking (CREATE INDEX CONCURRENTLY)
-- Run against the live database: psql "$DATABASE_URL" -f database/migrations/002_performance_indexes.sql

-- Historial paginado por fecha de entrega
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stops_delivered_at
  ON stops (delivered_at DESC) WHERE delivered_at IS NOT NULL;

-- Listados de tienda filtrados por estado (query compuesta más común en shop dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stops_shop_status
  ON stops (shop_id, status);

-- Listados de repartidor filtrados por estado (query compuesta más común en driver view)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stops_driver_status
  ON stops (driver_id, status);

-- Limpieza de fotos antiguas por fecha de creación
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_photos_created_at
  ON order_photos (created_at);
