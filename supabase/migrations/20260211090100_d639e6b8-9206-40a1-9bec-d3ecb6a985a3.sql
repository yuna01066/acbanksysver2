
-- Drop existing restrictive UPDATE policies
DROP POLICY IF EXISTS "Users can update their own quotes" ON public.saved_quotes;
DROP POLICY IF EXISTS "Managers can update all quotes" ON public.saved_quotes;
DROP POLICY IF EXISTS "Moderators can update all quotes" ON public.saved_quotes;
DROP POLICY IF EXISTS "Project assignees can update project quotes" ON public.saved_quotes;

-- Recreate as PERMISSIVE policies (any one match = allowed)
CREATE POLICY "Users can update their own quotes"
ON public.saved_quotes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Managers can update all quotes"
ON public.saved_quotes
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Moderators can update all quotes"
ON public.saved_quotes
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Project assignees can update project quotes"
ON public.saved_quotes
FOR UPDATE
TO authenticated
USING (
  project_id IS NOT NULL 
  AND is_project_assigned(project_id, auth.uid())
);
