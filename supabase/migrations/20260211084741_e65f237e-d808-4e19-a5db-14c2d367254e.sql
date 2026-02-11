-- Manager 역할도 모든 견적서 조회/수정 가능
CREATE POLICY "Managers can view all quotes"
ON public.saved_quotes
FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can update all quotes"
ON public.saved_quotes
FOR UPDATE
USING (has_role(auth.uid(), 'manager'::app_role));

-- 프로젝트 담당자가 해당 프로젝트의 견적서를 조회/수정 가능
CREATE POLICY "Project assignees can view project quotes"
ON public.saved_quotes
FOR SELECT
USING (
  project_id IS NOT NULL 
  AND is_project_assigned(project_id, auth.uid())
);

CREATE POLICY "Project assignees can update project quotes"
ON public.saved_quotes
FOR UPDATE
USING (
  project_id IS NOT NULL 
  AND is_project_assigned(project_id, auth.uid())
);