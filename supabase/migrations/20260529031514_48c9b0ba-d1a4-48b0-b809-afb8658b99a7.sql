DROP POLICY IF EXISTS "Authenticated users can read checked in employee status" ON public.checked_in_employee_status;

CREATE POLICY "Authenticated users can read checked in employee status"
ON public.checked_in_employee_status
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND date = ((now() AT TIME ZONE 'Asia/Seoul')::date)
);

CREATE OR REPLACE FUNCTION public.sync_checked_in_employee_status_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_row record;
  local_today date := ((now() AT TIME ZONE 'Asia/Seoul')::date);
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.checked_in_employee_status WHERE user_id = OLD.user_id;
    RETURN OLD;
  END IF;

  IF NEW.date = local_today AND NEW.status IN ('checked_in', 'present') THEN
    SELECT avatar_url, department, position
    INTO profile_row
    FROM public.profiles
    WHERE id = NEW.user_id;

    INSERT INTO public.checked_in_employee_status (
      user_id, user_name, check_in, date, status, avatar_url, department, position, synced_at
    )
    VALUES (
      NEW.user_id, NEW.user_name, NEW.check_in, NEW.date, NEW.status,
      profile_row.avatar_url, profile_row.department, profile_row.position, now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      user_name = EXCLUDED.user_name,
      check_in = EXCLUDED.check_in,
      date = EXCLUDED.date,
      status = EXCLUDED.status,
      avatar_url = EXCLUDED.avatar_url,
      department = EXCLUDED.department,
      position = EXCLUDED.position,
      synced_at = now();
  ELSE
    DELETE FROM public.checked_in_employee_status WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_checked_in_employee_status_row() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_checked_in_employee_status_row() FROM anon;
REVOKE ALL ON FUNCTION public.sync_checked_in_employee_status_row() FROM authenticated;

GRANT SELECT ON public.checked_in_employee_status TO authenticated;
GRANT ALL ON public.checked_in_employee_status TO service_role;