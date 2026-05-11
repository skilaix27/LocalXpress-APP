-- Migration 009: Add scheduled_time and scheduled_time_type to stops
-- These fields store the human-readable time label and the slot type sent by lxp-ind.
-- Run on the VPS BEFORE deploying the new backend build.

ALTER TABLE stops
  ADD COLUMN IF NOT EXISTS scheduled_time      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS scheduled_time_type VARCHAR(20);

ALTER TABLE stops_archive
  ADD COLUMN IF NOT EXISTS scheduled_time      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS scheduled_time_type VARCHAR(20);
