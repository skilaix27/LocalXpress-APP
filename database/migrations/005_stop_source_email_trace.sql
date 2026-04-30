-- Migration 005: Add source/email traceability columns to stops and stops_archive
-- Run: psql "$DATABASE_URL" -f database/migrations/005_stop_source_email_trace.sql
-- Safe to run multiple times (IF NOT EXISTS / DO NOTHING guards).

-- ─── stops ────────────────────────────────────────────────────────────────────
ALTER TABLE stops
  ADD COLUMN IF NOT EXISTS source        TEXT DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS email_from    TEXT,
  ADD COLUMN IF NOT EXISTS email_subject TEXT;

-- ─── stops_archive ────────────────────────────────────────────────────────────
ALTER TABLE stops_archive
  ADD COLUMN IF NOT EXISTS source        TEXT DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS email_from    TEXT,
  ADD COLUMN IF NOT EXISTS email_subject TEXT;

-- ─── Backfill existing records ─────────────────────────────────────────────────
-- Stops created without source were created through the app, keep 'app'.
-- B2B stops created via /api/stops/order before this migration had no source
-- column, so they also get 'app'. That's acceptable — no way to distinguish now.
UPDATE stops        SET source = 'app' WHERE source IS NULL;
UPDATE stops_archive SET source = 'app' WHERE source IS NULL;
