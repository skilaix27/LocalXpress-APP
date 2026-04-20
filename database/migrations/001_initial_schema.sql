-- ═══════════════════════════════════════════════════════════════════════════════
-- LocalXpress — Initial Schema
-- PostgreSQL 16+
-- Run: psql "$DATABASE_URL" -f 001_initial_schema.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

-- ─── Enums ────────────────────────────────────────────────────────────────────
CREATE TYPE app_role     AS ENUM ('admin', 'driver', 'shop');
CREATE TYPE stop_status  AS ENUM ('pending', 'assigned', 'picked', 'delivered');
CREATE TYPE package_size AS ENUM ('small', 'medium', 'large');

-- ─── users ────────────────────────────────────────────────────────────────────
-- Replaces Supabase auth.users. Owns email/password auth.
CREATE TABLE users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── profiles ─────────────────────────────────────────────────────────────────
-- Auto-created on INSERT INTO users via trigger below.
CREATE TABLE profiles (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name               TEXT,
  phone                   TEXT,
  avatar_url              TEXT,
  is_active               BOOLEAN     NOT NULL DEFAULT TRUE,
  -- shop-specific fields
  shop_name               TEXT,
  default_pickup_address  TEXT,
  default_pickup_lat      DOUBLE PRECISION,
  default_pickup_lng      DOUBLE PRECISION,
  -- financial / admin fields
  iban                    TEXT,
  nif                     TEXT,
  fiscal_address          TEXT,
  admin_notes             TEXT,
  privacy_accepted_at     TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── user_roles ───────────────────────────────────────────────────────────────
CREATE TABLE user_roles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       app_role    NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- ─── stops ────────────────────────────────────────────────────────────────────
CREATE TABLE stops (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code          TEXT,
  -- pickup
  pickup_address      TEXT         NOT NULL,
  pickup_lat          DOUBLE PRECISION,
  pickup_lng          DOUBLE PRECISION,
  -- delivery
  delivery_address    TEXT         NOT NULL,
  delivery_lat        DOUBLE PRECISION,
  delivery_lng        DOUBLE PRECISION,
  -- client
  client_name         TEXT         NOT NULL,
  client_phone        TEXT,
  client_notes        TEXT,
  -- assignment
  driver_id           UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  shop_id             UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  created_by          UUID         REFERENCES users(id)    ON DELETE SET NULL,
  -- status
  status              stop_status  NOT NULL DEFAULT 'pending',
  package_size        package_size DEFAULT 'medium',
  -- pricing
  distance_km         DOUBLE PRECISION,
  price               DOUBLE PRECISION,
  price_driver        DOUBLE PRECISION,
  price_company       DOUBLE PRECISION,
  -- payment tracking
  paid_by_client      BOOLEAN      NOT NULL DEFAULT FALSE,
  paid_by_client_at   TIMESTAMPTZ,
  paid_to_driver      BOOLEAN      NOT NULL DEFAULT FALSE,
  paid_to_driver_at   TIMESTAMPTZ,
  -- proof
  proof_photo_url     TEXT,
  shop_name           TEXT,
  -- timestamps
  scheduled_pickup_at TIMESTAMPTZ,
  picked_at           TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- order_code unique only when set
CREATE UNIQUE INDEX idx_stops_order_code ON stops (order_code) WHERE order_code IS NOT NULL;

-- ─── driver_locations ─────────────────────────────────────────────────────────
CREATE TABLE driver_locations (
  id         UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id  UUID             UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lat        DOUBLE PRECISION NOT NULL,
  lng        DOUBLE PRECISION NOT NULL,
  heading    DOUBLE PRECISION,
  speed      DOUBLE PRECISION,
  updated_at TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- ─── pricing_zones ────────────────────────────────────────────────────────────
CREATE TABLE pricing_zones (
  id            UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT             NOT NULL,
  min_km        DOUBLE PRECISION NOT NULL,
  max_km        DOUBLE PRECISION,               -- NULL = unbounded last zone
  fixed_price   DOUBLE PRECISION,
  per_km_price  DOUBLE PRECISION,
  sort_order    INTEGER          NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- ─── order_photos ─────────────────────────────────────────────────────────────
-- Replaces Supabase Storage delivery-proofs bucket references.
CREATE TABLE order_photos (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id    UUID        NOT NULL REFERENCES stops(id)    ON DELETE CASCADE,
  driver_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_path  TEXT        NOT NULL,   -- relative path within STORAGE_DIR
  file_size  INTEGER,
  mime_type  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── audit_logs ───────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  action        TEXT        NOT NULL,           -- CREATE, UPDATE, DELETE, LOGIN
  resource_type TEXT        NOT NULL,           -- stop, user, profile, ...
  resource_id   UUID,
  old_data      JSONB,
  new_data      JSONB,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX idx_stops_status        ON stops (status);
CREATE INDEX idx_stops_driver_id     ON stops (driver_id);
CREATE INDEX idx_stops_shop_id       ON stops (shop_id);
CREATE INDEX idx_stops_created_at    ON stops (created_at DESC);

CREATE INDEX idx_driver_loc_updated  ON driver_locations (updated_at DESC);

CREATE INDEX idx_order_photos_stop   ON order_photos (stop_id);

CREATE INDEX idx_audit_logs_user_id  ON audit_logs (user_id);
CREATE INDEX idx_audit_logs_created  ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs (resource_type, resource_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Trigger: updated_at
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_stops_updated_at
  BEFORE UPDATE ON stops
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_pricing_zones_updated_at
  BEFORE UPDATE ON pricing_zones
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- Trigger: auto-create profile when a user is inserted
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO profiles (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_user_created
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION fn_handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed: default pricing zones (same as Supabase production data)
-- Remove or adjust these values before deploying to production.
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO pricing_zones (name, min_km, max_km, fixed_price, per_km_price, sort_order) VALUES
  ('Zona 1 (0–5 km)',    0,   5,  5.00, NULL, 1),
  ('Zona 2 (5–10 km)',   5,  10,  8.00, NULL, 2),
  ('Zona 3 (10–20 km)', 10,  20, NULL, 0.90, 3),
  ('Zona 4 (+20 km)',   20, NULL, NULL, 1.10, 4);
