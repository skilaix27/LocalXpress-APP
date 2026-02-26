
-- Auto-delete driver locations older than 30 days for privacy
CREATE OR REPLACE FUNCTION public.cleanup_old_driver_locations()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.driver_locations 
  WHERE updated_at < now() - interval '30 days';
$$;

-- Add index for faster cleanup queries
CREATE INDEX IF NOT EXISTS idx_driver_locations_updated_at ON public.driver_locations(updated_at);
