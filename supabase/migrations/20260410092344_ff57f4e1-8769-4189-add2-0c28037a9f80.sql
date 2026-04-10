
-- 1. Create pricing_zones table
CREATE TABLE public.pricing_zones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  min_km double precision NOT NULL DEFAULT 0,
  max_km double precision,
  fixed_price numeric(10,2),
  per_km_price numeric(10,2),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pricing zones"
  ON public.pricing_zones FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view pricing zones"
  ON public.pricing_zones FOR SELECT
  TO authenticated
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_pricing_zones_updated_at
  BEFORE UPDATE ON public.pricing_zones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default zones
INSERT INTO public.pricing_zones (name, min_km, max_km, fixed_price, per_km_price, sort_order) VALUES
  ('Zona 1', 0, 2.5, 8.00, NULL, 1),
  ('Zona 2', 2.5, 7, 11.00, NULL, 2),
  ('Zona 3', 7, 15, 14.00, NULL, 3),
  ('Zona 3+', 15, NULL, 14.00, 1.00, 4);

-- 2. Add pricing columns to stops
ALTER TABLE public.stops
  ADD COLUMN price numeric(10,2),
  ADD COLUMN price_driver numeric(10,2),
  ADD COLUMN price_company numeric(10,2);

-- 3. Add fiscal/detail fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN nif text,
  ADD COLUMN fiscal_address text,
  ADD COLUMN iban text,
  ADD COLUMN admin_notes text;
