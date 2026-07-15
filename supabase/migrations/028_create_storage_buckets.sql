-- ============================================================
-- Create required Storage buckets for photo and attachment uploads
-- ============================================================

-- Bucket for merchant profile photos + admin uploads
SELECT storage.create_bucket(
  'app_assets',
  jsonb_build_object(
    'public', true,
    'allowed_mime_types', array['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    'file_size_limit', 5242880  -- 5 MB
  )
);

-- Bucket for transaction bill/photo attachments
SELECT storage.create_bucket(
  'transaction_attachments',
  jsonb_build_object(
    'public', true,
    'allowed_mime_types', array['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    'file_size_limit', 5242880  -- 5 MB
  )
);

-- Allow public access to files in both buckets
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id IN ('app_assets', 'transaction_attachments'));

-- Allow authenticated merchants to upload files
CREATE POLICY "Merchant Upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id IN ('app_assets', 'transaction_attachments')
    AND auth.role() = 'authenticated'
  );
