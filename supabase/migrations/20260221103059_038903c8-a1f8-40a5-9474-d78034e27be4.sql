
-- Add proof photo column to stops
ALTER TABLE public.stops ADD COLUMN proof_photo_url TEXT;

-- Create storage bucket for delivery proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('delivery-proofs', 'delivery-proofs', true);

-- Storage policies for delivery proofs
CREATE POLICY "Drivers can upload delivery proofs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'delivery-proofs' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view delivery proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'delivery-proofs');

CREATE POLICY "Admins can delete delivery proofs"
ON storage.objects FOR DELETE
USING (bucket_id = 'delivery-proofs' AND public.has_role(auth.uid(), 'admin'));
