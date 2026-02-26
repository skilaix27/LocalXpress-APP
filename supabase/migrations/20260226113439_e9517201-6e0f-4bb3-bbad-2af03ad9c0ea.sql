-- Make the delivery-proofs bucket private
UPDATE storage.buckets SET public = false WHERE id = 'delivery-proofs';

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Authenticated users can upload delivery proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'delivery-proofs');

-- Allow authenticated users to read delivery proofs
CREATE POLICY "Authenticated users can read delivery proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'delivery-proofs');
