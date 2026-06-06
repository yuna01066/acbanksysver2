CREATE OR REPLACE FUNCTION public.is_approved_user(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _user_id
      AND p.is_approved IS TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.touch_client_consultation_leads_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

ALTER POLICY "Authenticated users can read announcements"
ON public.announcements
TO authenticated
USING (public.is_approved_user());

ALTER POLICY "Authenticated users can read team messages"
ON public.team_messages
TO authenticated
USING (public.is_approved_user());

ALTER POLICY "Authenticated users can read contract templates"
ON public.contract_templates
TO authenticated
USING (public.is_approved_user());

ALTER POLICY "Authenticated users can read review targets"
ON public.review_cycle_targets
TO authenticated
USING (public.is_approved_user());

ALTER POLICY "settings_read_auth"
ON public.response_assistant_settings
TO authenticated
USING (public.is_approved_user());

ALTER POLICY "knowledge_read_auth"
ON public.response_knowledge_items
TO authenticated
USING (public.is_approved_user());

DROP POLICY IF EXISTS "Authenticated users can update portfolio thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete portfolio thumbnails" ON storage.objects;

CREATE POLICY "Owners and managers can update portfolio thumbnails"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'portfolio-thumbnails'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    OR (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1
      FROM public.portfolio_images pi
      WHERE pi.thumbnail_bucket = 'portfolio-thumbnails'
        AND pi.thumbnail_path = storage.objects.name
        AND pi.uploaded_by = (auth.uid())::text
    )
  )
)
WITH CHECK (
  bucket_id = 'portfolio-thumbnails'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    OR (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1
      FROM public.portfolio_images pi
      WHERE pi.thumbnail_bucket = 'portfolio-thumbnails'
        AND pi.thumbnail_path = storage.objects.name
        AND pi.uploaded_by = (auth.uid())::text
    )
  )
);

CREATE POLICY "Owners and managers can delete portfolio thumbnails"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'portfolio-thumbnails'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    OR (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1
      FROM public.portfolio_images pi
      WHERE pi.thumbnail_bucket = 'portfolio-thumbnails'
        AND pi.thumbnail_path = storage.objects.name
        AND pi.uploaded_by = (auth.uid())::text
    )
  )
);

DROP POLICY IF EXISTS "Authenticated users can upload project update attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read project update attachments" ON storage.objects;

CREATE POLICY "Users can upload own project update attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-update-attachments'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  )
);

CREATE POLICY "Project members can read project update attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-update-attachments'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.project_updates pu
      WHERE pu.attachments @> jsonb_build_array(jsonb_build_object('path', storage.objects.name))
        AND (
          pu.user_id = auth.uid()
          OR (
            pu.project_id IS NOT NULL
            AND (
              EXISTS (
                SELECT 1
                FROM public.projects p
                WHERE p.id = pu.project_id
                  AND p.user_id = auth.uid()
              )
              OR public.is_project_assigned(pu.project_id, auth.uid())
            )
          )
        )
    )
  )
);