-- Keep the existing TEXT columns for legacy import markers, but normalize every
-- historical email value that can be mapped to an auth user. New application
-- writes store auth.users.id::text directly.
UPDATE public.portfolio_posts AS post
SET created_by = auth_user.id::text
FROM auth.users AS auth_user
WHERE auth_user.email IS NOT NULL
  AND lower(btrim(post.created_by)) = lower(btrim(auth_user.email))
  AND post.created_by IS DISTINCT FROM auth_user.id::text;

UPDATE public.portfolio_images AS image
SET uploaded_by = auth_user.id::text
FROM auth.users AS auth_user
WHERE image.uploaded_by IS NOT NULL
  AND auth_user.email IS NOT NULL
  AND lower(btrim(image.uploaded_by)) = lower(btrim(auth_user.email))
  AND image.uploaded_by IS DISTINCT FROM auth_user.id::text;

-- Portfolio mutations are admin operations. Read policies remain unchanged so
-- existing authenticated gallery browsing continues to work.
DROP POLICY IF EXISTS "Authenticated users can create portfolio posts" ON public.portfolio_posts;
DROP POLICY IF EXISTS "Authenticated users can update portfolio posts" ON public.portfolio_posts;
DROP POLICY IF EXISTS "Authenticated users can delete portfolio posts" ON public.portfolio_posts;
DROP POLICY IF EXISTS "Owners or staff can update portfolio posts" ON public.portfolio_posts;
DROP POLICY IF EXISTS "Owners or staff can delete portfolio posts" ON public.portfolio_posts;
DROP POLICY IF EXISTS "Admins can create portfolio posts" ON public.portfolio_posts;
DROP POLICY IF EXISTS "Admins can update portfolio posts" ON public.portfolio_posts;
DROP POLICY IF EXISTS "Admins can delete portfolio posts" ON public.portfolio_posts;

CREATE POLICY "Admins can create portfolio posts"
ON public.portfolio_posts
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update portfolio posts"
ON public.portfolio_posts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete portfolio posts"
ON public.portfolio_posts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated users can create portfolio images" ON public.portfolio_images;
DROP POLICY IF EXISTS "Authenticated users can update portfolio images" ON public.portfolio_images;
DROP POLICY IF EXISTS "Authenticated users can delete portfolio images" ON public.portfolio_images;
DROP POLICY IF EXISTS "Owners or staff can update portfolio images" ON public.portfolio_images;
DROP POLICY IF EXISTS "Owners or staff can delete portfolio images" ON public.portfolio_images;
DROP POLICY IF EXISTS "Admins can create portfolio images" ON public.portfolio_images;
DROP POLICY IF EXISTS "Admins can update portfolio images" ON public.portfolio_images;
DROP POLICY IF EXISTS "Admins can delete portfolio images" ON public.portfolio_images;

CREATE POLICY "Admins can create portfolio images"
ON public.portfolio_images
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update portfolio images"
ON public.portfolio_images
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete portfolio images"
ON public.portfolio_images
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated users can upload portfolio thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update portfolio thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete portfolio thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Owners and managers can update portfolio thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Owners and managers can delete portfolio thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload portfolio thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update portfolio thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete portfolio thumbnails" ON storage.objects;

CREATE POLICY "Admins can upload portfolio thumbnails"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'portfolio-thumbnails'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can update portfolio thumbnails"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'portfolio-thumbnails'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'portfolio-thumbnails'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can delete portfolio thumbnails"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'portfolio-thumbnails'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
