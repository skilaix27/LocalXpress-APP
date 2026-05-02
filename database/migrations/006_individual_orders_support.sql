-- ────────────────────────────────────────────────────────────────────────────
-- 006 — Individual orders support
-- Adds columns needed to track public (Stripe-paid) individual orders.
-- Safe to run multiple times (IF NOT EXISTS / DO NOTHING patterns).
-- ────────────────────────────────────────────────────────────────────────────

-- ─── stops table ─────────────────────────────────────────────────────────────
ALTER TABLE stops
  ADD COLUMN IF NOT EXISTS order_type                 TEXT DEFAULT 'business',
  ADD COLUMN IF NOT EXISTS payment_status             TEXT DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id   TEXT NULL,
  ADD COLUMN IF NOT EXISTS customer_email             TEXT NULL,
  ADD COLUMN IF NOT EXISTS customer_full_name         TEXT NULL,
  ADD COLUMN IF NOT EXISTS customer_phone             TEXT NULL;

-- ─── stops_archive table ─────────────────────────────────────────────────────
ALTER TABLE stops_archive
  ADD COLUMN IF NOT EXISTS order_type                 TEXT DEFAULT 'business',
  ADD COLUMN IF NOT EXISTS payment_status             TEXT DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id   TEXT NULL,
  ADD COLUMN IF NOT EXISTS customer_email             TEXT NULL,
  ADD COLUMN IF NOT EXISTS customer_full_name         TEXT NULL,
  ADD COLUMN IF NOT EXISTS customer_phone             TEXT NULL;

-- ─── Backfill: existing rows are business orders ──────────────────────────────
UPDATE stops
SET order_type = 'business'
WHERE order_type IS NULL;

UPDATE stops
SET payment_status = CASE
  WHEN paid_by_client = true THEN 'paid'
  ELSE 'unpaid'
END
WHERE payment_status IS NULL OR payment_status = 'unpaid';

UPDATE stops_archive
SET order_type = 'business'
WHERE order_type IS NULL;

UPDATE stops_archive
SET payment_status = CASE
  WHEN paid_by_client = true THEN 'paid'
  ELSE 'unpaid'
END
WHERE payment_status IS NULL OR payment_status = 'unpaid';

-- ─── Indexes on stops ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stops_order_type
  ON stops (order_type);

CREATE INDEX IF NOT EXISTS idx_stops_payment_status
  ON stops (payment_status);

CREATE INDEX IF NOT EXISTS idx_stops_source
  ON stops (source);

CREATE INDEX IF NOT EXISTS idx_stops_stripe_checkout_session_id
  ON stops (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

-- ─── Indexes on stops_archive ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stops_archive_order_type
  ON stops_archive (order_type);

CREATE INDEX IF NOT EXISTS idx_stops_archive_payment_status
  ON stops_archive (payment_status);

CREATE INDEX IF NOT EXISTS idx_stops_archive_source
  ON stops_archive (source);
