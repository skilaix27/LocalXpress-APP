ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shop_name text,
  ADD COLUMN IF NOT EXISTS default_pickup_address text,
  ADD COLUMN IF NOT EXISTS default_pickup_lat double precision,
  ADD COLUMN IF NOT EXISTS default_pickup_lng double precision;