
-- Fix infinite recursion: project_assignments policies reference projects, and projects policies reference project_assignments
-- Solution: Use a security definer function to check project ownership without triggering RLS

CREATE OR REPLACE FUNCTION public.is_project_owner(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = _project_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_project_assigned(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_assignments
    WHERE project_id = _project_id AND user_id = _user_id
  )
$$;

-- Fix project_assignments policies
DROP POLICY IF EXISTS "Project owners can manage assignments" ON public.project_assignments;
DROP POLICY IF EXISTS "Users can view assignments for their projects" ON public.project_assignments;

CREATE POLICY "Project owners can manage assignments"
ON public.project_assignments FOR ALL
USING (public.is_project_owner(project_id, auth.uid()))
WITH CHECK (public.is_project_owner(project_id, auth.uid()));

CREATE POLICY "Users can view assignments for their projects"
ON public.project_assignments FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_project_owner(project_id, auth.uid())
);

-- Fix projects policies to use security definer function
DROP POLICY IF EXISTS "Users can view their own or assigned projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own or assigned projects" ON public.projects;

CREATE POLICY "Users can view their own or assigned projects"
ON public.projects FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_project_assigned(id, auth.uid())
);

CREATE POLICY "Users can update their own or assigned projects"
ON public.projects FOR UPDATE
USING (
  auth.uid() = user_id
  OR public.is_project_assigned(id, auth.uid())
);
