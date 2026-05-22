-- HR self-service portal tables and safeguards

CREATE OR REPLACE FUNCTION public.can_access_feature(_feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  min_role TEXT;
  user_rank INTEGER;
  min_rank INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    user_rank := 1;
  ELSIF public.has_role(auth.uid(), 'moderator'::app_role) THEN
    user_rank := 2;
  ELSIF public.has_role(auth.uid(), 'manager'::app_role) THEN
    user_rank := 3;
  ELSIF public.has_role(auth.uid(), 'employee'::app_role) OR public.has_role(auth.uid(), 'user'::app_role) THEN
    user_rank := 4;
  ELSE
    RETURN FALSE;
  END IF;

  SELECT pra.min_role INTO min_role
  FROM public.page_role_access pra
  WHERE pra.page_key = _feature_key
  LIMIT 1;

  min_role := COALESCE(min_role, 'admin');
  min_rank := CASE min_role
    WHEN 'admin' THEN 1
    WHEN 'moderator' THEN 2
    WHEN 'manager' THEN 3
    ELSE 4
  END;

  RETURN user_rank <= min_rank;
END;
$$;

INSERT INTO public.page_role_access (page_key, min_role)
VALUES ('finance.view_salary', 'admin')
ON CONFLICT (page_key) DO NOTHING;

DROP POLICY IF EXISTS "Moderators can update all profiles" ON public.profiles;
CREATE POLICY "Moderators can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'moderator'::app_role));

CREATE OR REPLACE FUNCTION public.enforce_profile_self_service_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.id
    AND NOT public.has_role(auth.uid(), 'admin'::app_role)
    AND NOT public.has_role(auth.uid(), 'moderator'::app_role)
  THEN
    IF NEW.full_name IS DISTINCT FROM OLD.full_name
      OR NEW.email IS DISTINCT FROM OLD.email
      OR NEW.employee_number IS DISTINCT FROM OLD.employee_number
      OR NEW.department IS DISTINCT FROM OLD.department
      OR NEW.position IS DISTINCT FROM OLD.position
      OR NEW.job_title IS DISTINCT FROM OLD.job_title
      OR NEW.job_group IS DISTINCT FROM OLD.job_group
      OR NEW.rank_title IS DISTINCT FROM OLD.rank_title
      OR NEW.rank_level IS DISTINCT FROM OLD.rank_level
      OR NEW.join_date IS DISTINCT FROM OLD.join_date
      OR NEW.group_join_date IS DISTINCT FROM OLD.group_join_date
      OR NEW.join_type IS DISTINCT FROM OLD.join_type
      OR NEW.work_type IS DISTINCT FROM OLD.work_type
      OR NEW.work_hours_per_week IS DISTINCT FROM OLD.work_hours_per_week
      OR NEW.overtime_policy IS DISTINCT FROM OLD.overtime_policy
      OR NEW.salary_info IS DISTINCT FROM OLD.salary_info
      OR NEW.wage_contract IS DISTINCT FROM OLD.wage_contract
      OR NEW.leave_policy IS DISTINCT FROM OLD.leave_policy
      OR NEW.holidays IS DISTINCT FROM OLD.holidays
      OR NEW.leave_history IS DISTINCT FROM OLD.leave_history
      OR NEW.awards IS DISTINCT FROM OLD.awards
      OR NEW.disciplinary IS DISTINCT FROM OLD.disciplinary
      OR NEW.career_history IS DISTINCT FROM OLD.career_history
      OR NEW.education IS DISTINCT FROM OLD.education
      OR NEW.special_notes IS DISTINCT FROM OLD.special_notes
      OR NEW.family_info IS DISTINCT FROM OLD.family_info
      OR NEW.family_basic_deduction IS DISTINCT FROM OLD.family_basic_deduction
      OR NEW.family_child_tax_credit IS DISTINCT FROM OLD.family_child_tax_credit
      OR NEW.family_health_dependents IS DISTINCT FROM OLD.family_health_dependents
      OR NEW.resident_registration_number IS DISTINCT FROM OLD.resident_registration_number
      OR NEW.is_approved IS DISTINCT FROM OLD.is_approved
    THEN
      RAISE EXCEPTION '관리자 승인이 필요한 인사 정보입니다.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_self_service_fields_trigger ON public.profiles;
CREATE TRIGGER enforce_profile_self_service_fields_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_self_service_fields();

CREATE TABLE IF NOT EXISTS public.profile_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile change requests"
  ON public.profile_change_requests FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = requested_by);

CREATE POLICY "Users can create own profile change requests"
  ON public.profile_change_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.uid() = requested_by);

CREATE POLICY "Users can cancel own pending profile change requests"
  ON public.profile_change_requests FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'cancelled'));

CREATE POLICY "Admins can manage profile change requests"
  ON public.profile_change_requests FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can manage profile change requests"
  ON public.profile_change_requests FOR ALL
  USING (public.has_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'moderator'::app_role));

CREATE INDEX IF NOT EXISTS idx_profile_change_requests_user_status
  ON public.profile_change_requests (user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.hr_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected', 'cancelled')),
  admin_comment TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own hr requests"
  ON public.hr_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own hr requests"
  ON public.hr_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can cancel own pending hr requests"
  ON public.hr_requests FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'cancelled'));

CREATE POLICY "Admins can manage hr requests"
  ON public.hr_requests FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can manage hr requests"
  ON public.hr_requests FOR ALL
  USING (public.has_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'moderator'::app_role));

CREATE INDEX IF NOT EXISTS idx_hr_requests_user_status
  ON public.hr_requests (user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.pay_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pay_month DATE NOT NULL,
  gross_pay NUMERIC,
  deductions JSONB NOT NULL DEFAULT '{}'::jsonb,
  net_pay NUMERIC,
  file_storage_path TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pay_month)
);

ALTER TABLE public.pay_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pay statements"
  ON public.pay_statements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Salary viewers can view pay statements"
  ON public.pay_statements FOR SELECT
  USING (public.can_access_feature('finance.view_salary'));

CREATE POLICY "Admins can manage pay statements"
  ON public.pay_statements FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can manage pay statements"
  ON public.pay_statements FOR ALL
  USING (public.has_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'moderator'::app_role));

CREATE INDEX IF NOT EXISTS idx_pay_statements_user_month
  ON public.pay_statements (user_id, pay_month DESC);

CREATE TABLE IF NOT EXISTS public.employee_hr_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  linked_resource JSONB NOT NULL DEFAULT '{}'::jsonb,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_hr_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own hr tasks"
  ON public.employee_hr_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own hr task status"
  ON public.employee_hr_tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage hr tasks"
  ON public.employee_hr_tasks FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can manage hr tasks"
  ON public.employee_hr_tasks FOR ALL
  USING (public.has_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'moderator'::app_role));

CREATE INDEX IF NOT EXISTS idx_employee_hr_tasks_user_status
  ON public.employee_hr_tasks (user_id, status, due_date);

CREATE OR REPLACE FUNCTION public.apply_profile_change_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.profiles
    SET
      full_name = COALESCE(NEW.changes->>'full_name', full_name),
      phone = COALESCE(NEW.changes->>'phone', phone),
      personal_email = COALESCE(NEW.changes->>'personal_email', personal_email),
      address = COALESCE(NEW.changes->>'address', address),
      detail_address = COALESCE(NEW.changes->>'detail_address', detail_address),
      zipcode = COALESCE(NEW.changes->>'zipcode', zipcode),
      nationality = COALESCE(NEW.changes->>'nationality', nationality),
      bank_name = COALESCE(NEW.changes->>'bank_name', bank_name),
      bank_account = COALESCE(NEW.changes->>'bank_account', bank_account),
      department = COALESCE(NEW.changes->>'department', department),
      position = COALESCE(NEW.changes->>'position', position),
      job_title = COALESCE(NEW.changes->>'job_title', job_title),
      job_group = COALESCE(NEW.changes->>'job_group', job_group),
      rank_title = COALESCE(NEW.changes->>'rank_title', rank_title),
      rank_level = COALESCE(NEW.changes->>'rank_level', rank_level),
      join_date = COALESCE(NULLIF(NEW.changes->>'join_date', '')::date, join_date),
      group_join_date = COALESCE(NULLIF(NEW.changes->>'group_join_date', '')::date, group_join_date),
      join_type = COALESCE(NEW.changes->>'join_type', join_type),
      work_type = COALESCE(NEW.changes->>'work_type', work_type),
      work_hours_per_week = COALESCE(NULLIF(NEW.changes->>'work_hours_per_week', '')::numeric, work_hours_per_week),
      overtime_policy = COALESCE(NEW.changes->>'overtime_policy', overtime_policy),
      salary_info = COALESCE(NEW.changes->>'salary_info', salary_info),
      wage_contract = COALESCE(NEW.changes->>'wage_contract', wage_contract),
      leave_policy = COALESCE(NEW.changes->>'leave_policy', leave_policy),
      holidays = COALESCE(NEW.changes->>'holidays', holidays),
      leave_history = COALESCE(NEW.changes->>'leave_history', leave_history),
      awards = COALESCE(NEW.changes->>'awards', awards),
      disciplinary = COALESCE(NEW.changes->>'disciplinary', disciplinary),
      career_history = COALESCE(NEW.changes->>'career_history', career_history),
      education = COALESCE(NEW.changes->>'education', education),
      special_notes = COALESCE(NEW.changes->>'special_notes', special_notes),
      family_info = COALESCE(NEW.changes->>'family_info', family_info)
    WHERE id = NEW.user_id;

    INSERT INTO public.notifications (user_id, type, title, description, data)
    VALUES (
      NEW.user_id,
      'profile_change_approved',
      '인사 정보 변경 승인',
      '요청하신 인사 정보 변경이 승인되어 반영되었습니다.',
      jsonb_build_object('requestId', NEW.id)
    );
  ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, type, title, description, data)
    VALUES (
      NEW.user_id,
      'profile_change_rejected',
      '인사 정보 변경 반려',
      COALESCE(NEW.review_comment, '요청하신 인사 정보 변경이 반려되었습니다.'),
      jsonb_build_object('requestId', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_profile_change_request_trigger ON public.profile_change_requests;
CREATE TRIGGER apply_profile_change_request_trigger
  AFTER UPDATE ON public.profile_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.apply_profile_change_request();

CREATE OR REPLACE FUNCTION public.notify_admins_for_hr_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id UUID;
BEGIN
  FOR recipient_id IN
    SELECT DISTINCT user_id
    FROM public.user_roles
    WHERE role IN ('admin'::app_role, 'moderator'::app_role)
  LOOP
    INSERT INTO public.notifications (user_id, type, title, description, data)
    VALUES (
      recipient_id,
      'hr_request',
      '새 HR 요청',
      '직원의 HR 요청이 접수되었습니다.',
      jsonb_build_object('requestId', NEW.id, 'requestType', NEW.request_type, 'userId', NEW.user_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_admins_for_hr_request_trigger ON public.hr_requests;
CREATE TRIGGER notify_admins_for_hr_request_trigger
  AFTER INSERT ON public.hr_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_for_hr_request();

CREATE OR REPLACE FUNCTION public.notify_admins_for_profile_change_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id UUID;
BEGIN
  FOR recipient_id IN
    SELECT DISTINCT user_id
    FROM public.user_roles
    WHERE role IN ('admin'::app_role, 'moderator'::app_role)
  LOOP
    INSERT INTO public.notifications (user_id, type, title, description, data)
    VALUES (
      recipient_id,
      'profile_change_request',
      '인사 정보 변경 요청',
      '직원의 인사 정보 변경 요청이 접수되었습니다.',
      jsonb_build_object('requestId', NEW.id, 'userId', NEW.user_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_admins_for_profile_change_request_trigger ON public.profile_change_requests;
CREATE TRIGGER notify_admins_for_profile_change_request_trigger
  AFTER INSERT ON public.profile_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_for_profile_change_request();

CREATE TRIGGER update_profile_change_requests_updated_at
  BEFORE UPDATE ON public.profile_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hr_requests_updated_at
  BEFORE UPDATE ON public.hr_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pay_statements_updated_at
  BEFORE UPDATE ON public.pay_statements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_hr_tasks_updated_at
  BEFORE UPDATE ON public.employee_hr_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('pay-statements', 'pay-statements', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can view own pay statement files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'pay-statements'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.can_access_feature('finance.view_salary')
    )
  );

CREATE POLICY "Salary managers can upload pay statement files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pay-statements'
    AND public.can_access_feature('finance.view_salary')
  );

CREATE POLICY "Salary managers can update pay statement files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'pay-statements'
    AND public.can_access_feature('finance.view_salary')
  )
  WITH CHECK (
    bucket_id = 'pay-statements'
    AND public.can_access_feature('finance.view_salary')
  );

CREATE POLICY "Salary managers can delete pay statement files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'pay-statements'
    AND public.can_access_feature('finance.view_salary')
  );
