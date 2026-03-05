
-- 1. Add manager policies for projects table
CREATE POLICY "Managers can view all projects"
ON public.projects FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage all projects"
ON public.projects FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

-- 2. Add manager policies for internal_project_documents
CREATE POLICY "Managers can manage all internal documents"
ON public.internal_project_documents FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

-- 3. Add manager policies for project_assignments
CREATE POLICY "Managers can manage all assignments"
ON public.project_assignments FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

-- 4. Allow project assignees to also insert/update/delete internal documents
CREATE POLICY "Project assignees can manage documents"
ON public.internal_project_documents FOR ALL
USING (is_project_assigned(project_id, auth.uid()))
WITH CHECK (is_project_assigned(project_id, auth.uid()));

-- 5. Drop the old limited SELECT-only policy for assignees (replaced by the ALL policy above)
DROP POLICY IF EXISTS "Project assignees can view documents" ON public.internal_project_documents;

-- 6. Add manager policies for project_updates
CREATE POLICY "Managers can manage all project updates"
ON public.project_updates FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

-- 7. Add manager SELECT for project_assignments (so they can see who's assigned)
CREATE POLICY "Managers can view all assignments"
ON public.project_assignments FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));
