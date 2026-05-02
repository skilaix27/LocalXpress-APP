-- 008_email_idempotency.sql
-- Idempotency guards for outbound customer emails

ALTER TABLE stops
  ADD COLUMN IF NOT EXISTS payment_confirmation_sent_at  TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS payment_confirmation_error    TEXT        NULL;

ALTER TABLE stops_archive
  ADD COLUMN IF NOT EXISTS payment_confirmation_sent_at  TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS payment_confirmation_error    TEXT        NULL;
