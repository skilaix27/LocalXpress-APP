CREATE POLICY "Shops can delete their own undelivered stops"
ON public.stops
FOR DELETE
USING (
  (shop_id = get_profile_id(auth.uid()))
  AND has_role(auth.uid(), 'shop'::app_role)
  AND status != 'delivered'
);