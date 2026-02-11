
-- Drop existing restrictive user policies
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;

-- Recreate with assignee support
CREATE POLICY "Users can view their own or assigned projects"
ON public.projects FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.project_assignments pa
    WHERE pa.project_id = projects.id AND pa.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own or assigned projects"
ON public.projects FOR UPDATE
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.project_assignments pa
    WHERE pa.project_id = projects.id AND pa.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own projects"
ON public.projects FOR DELETE
USING (auth.uid() = user_id);
