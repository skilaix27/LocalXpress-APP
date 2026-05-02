-- 007_delivery_notifications.sql
-- Tracking de notificaciones de entrega para pedidos particulares

ALTER TABLE stops
  ADD COLUMN IF NOT EXISTS delivery_notified_at     TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS delivery_notification_error TEXT       NULL;

ALTER TABLE stops_archive
  ADD COLUMN IF NOT EXISTS delivery_notified_at     TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS delivery_notification_error TEXT       NULL;
