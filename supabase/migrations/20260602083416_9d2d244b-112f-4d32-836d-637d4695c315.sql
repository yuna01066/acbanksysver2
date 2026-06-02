-- 1) Profiles: prevent self-approval via UPDATE policy WITH CHECK
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'moderator'::app_role)
      OR is_approved = (SELECT p.is_approved FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

-- 2) project_updates: restrict broad authenticated read to project members + privileged roles
DROP POLICY IF EXISTS "Authenticated users can view project updates" ON public.project_updates;
CREATE POLICY "Project members can view project updates"
  ON public.project_updates FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR (
      project_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id = project_updates.project_id AND p.user_id = auth.uid()
        )
        OR public.is_project_assigned(project_id, auth.uid())
      )
    )
  );
