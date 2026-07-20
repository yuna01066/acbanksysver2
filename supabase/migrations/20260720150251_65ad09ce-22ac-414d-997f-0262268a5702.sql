
-- 1) client_error_logs: revoke anonymous insert capability
DROP POLICY IF EXISTS "Anon can insert anonymous error logs" ON public.client_error_logs;
REVOKE INSERT ON public.client_error_logs FROM anon;

-- 2) profiles: block self-editing of sensitive HR/payroll fields
CREATE OR REPLACE FUNCTION public.prevent_sensitive_profile_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_privileged boolean;
BEGIN
  -- Admins/moderators may edit anything
  is_privileged := public.has_role(auth.uid(), 'admin'::app_role)
                 OR public.has_role(auth.uid(), 'moderator'::app_role);

  IF is_privileged THEN
    RETURN NEW;
  END IF;

  -- Only enforce when the row owner is editing their own record
  IF auth.uid() IS DISTINCT FROM NEW.id THEN
    RETURN NEW;
  END IF;

  IF NEW.salary_info                 IS DISTINCT FROM OLD.salary_info
   OR NEW.wage_contract              IS DISTINCT FROM OLD.wage_contract
   OR NEW.bank_name                  IS DISTINCT FROM OLD.bank_name
   OR NEW.bank_account               IS DISTINCT FROM OLD.bank_account
   OR NEW.resident_registration_number IS DISTINCT FROM OLD.resident_registration_number
   OR NEW.employee_number            IS DISTINCT FROM OLD.employee_number
   OR NEW.join_date                  IS DISTINCT FROM OLD.join_date
   OR NEW.group_join_date            IS DISTINCT FROM OLD.group_join_date
   OR NEW.join_type                  IS DISTINCT FROM OLD.join_type
   OR NEW.job_title                  IS DISTINCT FROM OLD.job_title
   OR NEW.job_group                  IS DISTINCT FROM OLD.job_group
   OR NEW.rank_title                 IS DISTINCT FROM OLD.rank_title
   OR NEW.rank_level                 IS DISTINCT FROM OLD.rank_level
   OR NEW.work_type                  IS DISTINCT FROM OLD.work_type
   OR NEW.work_hours_per_week        IS DISTINCT FROM OLD.work_hours_per_week
   OR NEW.overtime_policy            IS DISTINCT FROM OLD.overtime_policy
   OR NEW.leave_policy               IS DISTINCT FROM OLD.leave_policy
   OR NEW.holidays                   IS DISTINCT FROM OLD.holidays
   OR NEW.leave_history              IS DISTINCT FROM OLD.leave_history
   OR NEW.awards                     IS DISTINCT FROM OLD.awards
   OR NEW.disciplinary               IS DISTINCT FROM OLD.disciplinary
   OR NEW.career_history             IS DISTINCT FROM OLD.career_history
   OR NEW.education                  IS DISTINCT FROM OLD.education
   OR NEW.family_info                IS DISTINCT FROM OLD.family_info
   OR NEW.family_basic_deduction     IS DISTINCT FROM OLD.family_basic_deduction
   OR NEW.family_child_tax_credit    IS DISTINCT FROM OLD.family_child_tax_credit
   OR NEW.family_health_dependents   IS DISTINCT FROM OLD.family_health_dependents
  THEN
    RAISE EXCEPTION 'HR/payroll fields on profiles can only be modified by admins or moderators'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_sensitive_profile_self_update ON public.profiles;
CREATE TRIGGER trg_prevent_sensitive_profile_self_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_sensitive_profile_self_update();
