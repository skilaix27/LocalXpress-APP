
-- Add shop_id column to stops table
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS shop_id uuid REFERENCES public.profiles(id);

-- RLS: Shops can view their own stops
CREATE POLICY "Shops can view their stops"
ON public.stops
FOR SELECT
TO authenticated
USING (shop_id = get_profile_id(auth.uid()) AND has_role(auth.uid(), 'shop'::app_role));

-- RLS: Shops can insert stops with their own shop_id
CREATE POLICY "Shops can create stops"
ON public.stops
FOR INSERT
TO authenticated
WITH CHECK (shop_id = get_profile_id(auth.uid()) AND has_role(auth.uid(), 'shop'::app_role));
