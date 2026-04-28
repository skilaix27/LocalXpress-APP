-- ═══════════════════════════════════════════════════════════════════════════════
-- LocalXpress — Stops Archive
-- Moves stops older than 32 days out of the active table
-- Run: psql "$DATABASE_URL" -f database/migrations/003_stops_archive.sql
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stops_archive (
  id                  UUID             NOT NULL,
  order_code          TEXT,
  -- pickup
  pickup_address      TEXT             NOT NULL,
  pickup_lat          DOUBLE PRECISION,
  pickup_lng          DOUBLE PRECISION,
  -- delivery
  delivery_address    TEXT             NOT NULL,
  delivery_lat        DOUBLE PRECISION,
  delivery_lng        DOUBLE PRECISION,
  -- client
  client_name         TEXT             NOT NULL,
  client_phone        TEXT,
  client_notes        TEXT,
  -- assignment (UUIDs stored without FK constraints so archive survives user deletes)
  driver_id           UUID,
  shop_id             UUID,
  created_by          UUID,
  -- status / sizing
  status              TEXT             NOT NULL DEFAULT 'delivered',
  package_size        TEXT,
  -- pricing
  distance_km         DOUBLE PRECISION,
  price               DOUBLE PRECISION,
  price_driver        DOUBLE PRECISION,
  price_company       DOUBLE PRECISION,
  -- payment
  paid_by_client      BOOLEAN          NOT NULL DEFAULT FALSE,
  paid_by_client_at   TIMESTAMPTZ,
  paid_to_driver      BOOLEAN          NOT NULL DEFAULT FALSE,
  paid_to_driver_at   TIMESTAMPTZ,
  -- proof photo is always NULL: photos are removed at 10 days, archive runs at 32 days
  proof_photo_url     TEXT             DEFAULT NULL,
  -- denormalized shop name
  shop_name           TEXT,
  -- timestamps from original stop
  scheduled_pickup_at TIMESTAMPTZ,
  picked_at           TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ      NOT NULL,
  updated_at          TIMESTAMPTZ      NOT NULL,
  -- archive timestamp
  archived_at         TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  PRIMARY KEY (id)
);

-- Indexes for fast filtering in history views
CREATE INDEX IF NOT EXISTS idx_stops_archive_created_at
  ON stops_archive (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stops_archive_archived_at
  ON stops_archive (archived_at DESC);

CREATE INDEX IF NOT EXISTS idx_stops_archive_order_code
  ON stops_archive (order_code) WHERE order_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stops_archive_shop_id
  ON stops_archive (shop_id) WHERE shop_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stops_archive_driver_id
  ON stops_archive (driver_id) WHERE driver_id IS NOT NULL;
