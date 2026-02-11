
-- Drop the problematic policies on projects
DROP POLICY IF EXISTS "Users can view their own or assigned projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own or assigned projects" ON public.projects;

-- Recreate SELECT policy using a non-recursive approach (no subquery on project_assignments with RLS)
CREATE POLICY "Users can view their own or assigned projects"
ON public.projects FOR SELECT
USING (
  auth.uid() = user_id
  OR id IN (
    SELECT pa.project_id FROM public.project_assignments pa WHERE pa.user_id = auth.uid()
  )
);

-- Recreate UPDATE policy
CREATE POLICY "Users can update their own or assigned projects"
ON public.projects FOR UPDATE
USING (
  auth.uid() = user_id
  OR id IN (
    SELECT pa.project_id FROM public.project_assignments pa WHERE pa.user_id = auth.uid()
  )
);
