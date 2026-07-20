-- Ensure quote operators can change saved quote assignees after security hardening.
-- Staff directory reads should use profile_directory, not the sensitive profiles table.

ALTER TABLE public.saved_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can update all quotes" ON public.saved_quotes;
DROP POLICY IF EXISTS "Moderators can update all quotes" ON public.saved_quotes;
DROP POLICY IF EXISTS "Managers can update all quotes" ON public.saved_quotes;
DROP POLICY IF EXISTS "Users can update their own quotes" ON public.saved_quotes;
DROP POLICY IF EXISTS "Users can update own issued or assigned quotes" ON public.saved_quotes;
DROP POLICY IF EXISTS "Project assignees can update project quotes" ON public.saved_quotes;

CREATE POLICY "Admins can update all quotes"
ON public.saved_quotes
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can update all quotes"
ON public.saved_quotes
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Managers can update all quotes"
ON public.saved_quotes
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Users can update own issued or assigned quotes"
ON public.saved_quotes
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR issuer_id = auth.uid()
  OR assigned_to = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
  OR issuer_id = auth.uid()
  OR assigned_to = auth.uid()
);

CREATE POLICY "Project assignees can update project quotes"
ON public.saved_quotes
FOR UPDATE
TO authenticated
USING (
  project_id IS NOT NULL
  AND public.is_project_assigned(project_id, auth.uid())
)
WITH CHECK (
  project_id IS NOT NULL
  AND public.is_project_assigned(project_id, auth.uid())
);

ALTER TABLE public.quote_activity_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view relevant quote activity history" ON public.quote_activity_history;
DROP POLICY IF EXISTS "Users can insert relevant quote activity history" ON public.quote_activity_history;

CREATE POLICY "Users can view relevant quote activity history"
ON public.quote_activity_history
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR actor_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.saved_quotes sq
    WHERE sq.id = quote_activity_history.quote_id
      AND (
        sq.user_id = auth.uid()
        OR sq.issuer_id = auth.uid()
        OR sq.assigned_to = auth.uid()
      )
  )
);

CREATE POLICY "Users can insert relevant quote activity history"
ON public.quote_activity_history
FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.saved_quotes sq
      WHERE sq.id = quote_activity_history.quote_id
        AND (
          sq.user_id = auth.uid()
          OR sq.issuer_id = auth.uid()
          OR sq.assigned_to = auth.uid()
        )
    )
  )
);
