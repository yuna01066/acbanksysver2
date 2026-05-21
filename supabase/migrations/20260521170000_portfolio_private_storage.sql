INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portfolio-thumbnails',
  'portfolio-thumbnails',
  false,
  5242880,
  ARRAY['image/webp', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.portfolio_images
  ADD COLUMN IF NOT EXISTS drive_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_path TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_bucket TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_path TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_width INTEGER CHECK (thumbnail_width IS NULL OR thumbnail_width > 0),
  ADD COLUMN IF NOT EXISTS thumbnail_height INTEGER CHECK (thumbnail_height IS NULL OR thumbnail_height > 0),
  ADD COLUMN IF NOT EXISTS access_level TEXT NOT NULL DEFAULT 'internal' CHECK (access_level IN ('internal', 'public')),
  ADD COLUMN IF NOT EXISTS delete_status TEXT NOT NULL DEFAULT 'active' CHECK (delete_status IN ('active', 'pending', 'failed', 'deleted')),
  ADD COLUMN IF NOT EXISTS delete_error TEXT;

CREATE INDEX IF NOT EXISTS idx_portfolio_images_thumbnail_path
  ON public.portfolio_images(thumbnail_bucket, thumbnail_path);

CREATE INDEX IF NOT EXISTS idx_portfolio_images_drive_folder_id
  ON public.portfolio_images(drive_folder_id);

DROP POLICY IF EXISTS "Authenticated users can update portfolio images" ON public.portfolio_images;

CREATE POLICY "Authenticated users can update portfolio images"
ON public.portfolio_images
FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can view portfolio thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload portfolio thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update portfolio thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete portfolio thumbnails" ON storage.objects;

CREATE POLICY "Authenticated users can view portfolio thumbnails"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'portfolio-thumbnails'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can upload portfolio thumbnails"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'portfolio-thumbnails'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can update portfolio thumbnails"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'portfolio-thumbnails'
  AND auth.uid() IS NOT NULL
)
WITH CHECK (
  bucket_id = 'portfolio-thumbnails'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can delete portfolio thumbnails"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'portfolio-thumbnails'
  AND auth.uid() IS NOT NULL
);
