
ALTER TABLE public.quote_status_recovery_backup_20260529 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage recovery backup"
ON public.quote_status_recovery_backup_20260529
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.quote_status_recovery_review_20260529 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage recovery review"
ON public.quote_status_recovery_review_20260529
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.prevent_profile_admin_field_self_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'moderator'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved
     OR NEW.employee_number IS DISTINCT FROM OLD.employee_number
     OR NEW.resident_registration_number IS DISTINCT FROM OLD.resident_registration_number
     OR NEW.salary_info IS DISTINCT FROM OLD.salary_info
     OR NEW.wage_contract IS DISTINCT FROM OLD.wage_contract
     OR NEW.disciplinary IS DISTINCT FROM OLD.disciplinary
     OR NEW.awards IS DISTINCT FROM OLD.awards
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
     OR NEW.leave_policy IS DISTINCT FROM OLD.leave_policy
     OR NEW.holidays IS DISTINCT FROM OLD.holidays
     OR NEW.leave_history IS DISTINCT FROM OLD.leave_history
     OR NEW.career_history IS DISTINCT FROM OLD.career_history
     OR NEW.department IS DISTINCT FROM OLD.department
     OR NEW.position IS DISTINCT FROM OLD.position
     OR NEW.email IS DISTINCT FROM OLD.email
  THEN
    RAISE EXCEPTION 'Permission denied: this profile field can only be modified by an administrator';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS prevent_profile_admin_field_self_update ON public.profiles;
CREATE TRIGGER prevent_profile_admin_field_self_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_admin_field_self_update();
