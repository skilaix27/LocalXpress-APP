-- ═══════════════════════════════════════════════════════════════════════════════
-- LocalXpress — Pricing Zone Driver Price
-- Adds price_driver column to pricing_zones table
-- Run: psql "$DATABASE_URL" -f database/migrations/004_pricing_zone_driver_price.sql
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE pricing_zones
  ADD COLUMN IF NOT EXISTS price_driver DOUBLE PRECISION DEFAULT 0;
