-- Keep "currently checked in" separate from "currently online".
-- Online presence is heartbeat-based and only visible to admins/moderators.

ALTER TABLE public.company_info
  ALTER COLUMN workplace_radius SET DEFAULT 800;

UPDATE public.company_info
SET workplace_radius = 800;

CREATE OR REPLACE FUNCTION public.check_workplace_distance(
  input_lat double precision,
  input_lng double precision
)
RETURNS TABLE (
  outside boolean,
  distance_meters double precision,
  radius_meters double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  workplace record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT workplace_lat, workplace_lng, COALESCE(workplace_radius, 800) AS workplace_radius
  INTO workplace
  FROM public.company_info
  WHERE workplace_lat IS NOT NULL
    AND workplace_lng IS NOT NULL
  LIMIT 1;

  IF workplace IS NULL OR input_lat IS NULL OR input_lng IS NULL THEN
    RETURN QUERY SELECT false, NULL::double precision, NULL::double precision;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    (
      6371000 * 2 * asin(
        sqrt(
          power(sin(radians(input_lat - workplace.workplace_lat) / 2), 2)
          + cos(radians(workplace.workplace_lat))
          * cos(radians(input_lat))
          * power(sin(radians(input_lng - workplace.workplace_lng) / 2), 2)
        )
      )
    ) > workplace.workplace_radius AS outside,
    (
      6371000 * 2 * asin(
        sqrt(
          power(sin(radians(input_lat - workplace.workplace_lat) / 2), 2)
          + cos(radians(workplace.workplace_lat))
          * cos(radians(input_lat))
          * power(sin(radians(input_lng - workplace.workplace_lng) / 2), 2)
        )
      )
    ) AS distance_meters,
    workplace.workplace_radius::double precision AS radius_meters;
END;
$$;

REVOKE ALL ON FUNCTION public.check_workplace_distance(double precision, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_workplace_distance(double precision, double precision) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_workplace_distance(double precision, double precision) TO authenticated;

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

  IF NEW.date = local_today
    AND NEW.status IN ('checked_in', 'present')
    AND NEW.check_in IS NOT NULL
    AND NEW.check_out IS NULL
  THEN
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

DROP TRIGGER IF EXISTS sync_checked_in_employee_status_row_trigger ON public.attendance_records;
CREATE TRIGGER sync_checked_in_employee_status_row_trigger
AFTER INSERT OR UPDATE OF user_name, check_in, check_out, date, status OR DELETE
ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.sync_checked_in_employee_status_row();

DELETE FROM public.checked_in_employee_status;

INSERT INTO public.checked_in_employee_status (
  user_id, user_name, check_in, date, status, avatar_url, department, position, synced_at
)
SELECT
  ar.user_id,
  ar.user_name,
  ar.check_in,
  ar.date,
  ar.status,
  p.avatar_url,
  p.department,
  p.position,
  now()
FROM public.attendance_records ar
LEFT JOIN public.profiles p ON p.id = ar.user_id
WHERE ar.date = ((now() AT TIME ZONE 'Asia/Seoul')::date)
  AND ar.status IN ('checked_in', 'present')
  AND ar.check_in IS NOT NULL
  AND ar.check_out IS NULL
ON CONFLICT (user_id) DO UPDATE SET
  user_name = EXCLUDED.user_name,
  check_in = EXCLUDED.check_in,
  date = EXCLUDED.date,
  status = EXCLUDED.status,
  avatar_url = EXCLUDED.avatar_url,
  department = EXCLUDED.department,
  position = EXCLUDED.position,
  synced_at = now();

CREATE OR REPLACE VIEW public.today_attendance_status
WITH (security_invoker = true)
AS
SELECT
  ar.user_id,
  ar.user_name,
  ar.date,
  ar.check_in,
  ar.check_out,
  ar.status
FROM public.attendance_records ar
WHERE ar.date = ((now() AT TIME ZONE 'Asia/Seoul')::date);

REVOKE ALL ON public.today_attendance_status FROM PUBLIC;
REVOKE ALL ON public.today_attendance_status FROM anon;
GRANT SELECT ON public.today_attendance_status TO authenticated;

CREATE TABLE IF NOT EXISTS public.employee_online_heartbeats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  work_status text NOT NULL DEFAULT 'available'
    CHECK (work_status IN ('available', 'busy', 'focusing', 'meeting')),
  online_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_online_heartbeats_last_seen
ON public.employee_online_heartbeats (last_seen_at DESC);

ALTER TABLE public.employee_online_heartbeats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own online heartbeat" ON public.employee_online_heartbeats;
CREATE POLICY "Users can manage own online heartbeat"
ON public.employee_online_heartbeats
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins and moderators can view online heartbeats" ON public.employee_online_heartbeats;
CREATE POLICY "Admins and moderators can view online heartbeats"
ON public.employee_online_heartbeats
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

CREATE OR REPLACE FUNCTION public.upsert_employee_online_heartbeat(
  _work_status text DEFAULT 'available',
  _user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_status text := COALESCE(_work_status, 'available');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_status NOT IN ('available', 'busy', 'focusing', 'meeting') THEN
    v_status := 'available';
  END IF;

  INSERT INTO public.employee_online_heartbeats (
    user_id, work_status, online_at, last_seen_at, user_agent, updated_at
  )
  VALUES (
    v_user_id, v_status, now(), now(), left(_user_agent, 500), now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    work_status = EXCLUDED.work_status,
    last_seen_at = now(),
    user_agent = EXCLUDED.user_agent,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_employee_offline()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.employee_online_heartbeats
  WHERE user_id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_employee_online_status()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text,
  department text,
  "position" text,
  work_status text,
  last_seen_at timestamptz,
  attendance_status text,
  check_in timestamptz,
  check_out timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  local_today date := ((now() AT TIME ZONE 'Asia/Seoul')::date);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (
    public.has_role(v_user_id, 'admin'::public.app_role)
    OR public.has_role(v_user_id, 'moderator'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Admin or moderator role required';
  END IF;

  RETURN QUERY
  SELECT
    h.user_id,
    COALESCE(pd.full_name, p.full_name, '이름 없음')::text AS full_name,
    COALESCE(pd.avatar_url, p.avatar_url)::text AS avatar_url,
    COALESCE(pd.department, p.department)::text AS department,
    COALESCE(pd.position, p.position)::text AS "position",
    h.work_status,
    h.last_seen_at,
    CASE
      WHEN ar.check_in IS NOT NULL AND ar.check_out IS NULL THEN 'checked_in'
      WHEN ar.check_out IS NOT NULL THEN 'checked_out'
      ELSE 'not_checked_in'
    END::text AS attendance_status,
    ar.check_in,
    ar.check_out
  FROM public.employee_online_heartbeats h
  LEFT JOIN public.profile_directory pd ON pd.id = h.user_id
  LEFT JOIN public.profiles p ON p.id = h.user_id
  LEFT JOIN LATERAL (
    SELECT attendance_records.check_in, attendance_records.check_out
    FROM public.attendance_records
    WHERE attendance_records.user_id = h.user_id
      AND attendance_records.date = local_today
    ORDER BY attendance_records.check_in DESC NULLS LAST, attendance_records.created_at DESC NULLS LAST
    LIMIT 1
  ) ar ON true
  WHERE h.last_seen_at >= now() - interval '2 minutes'
  ORDER BY h.last_seen_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_employee_online_heartbeat(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_employee_online_heartbeat(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.upsert_employee_online_heartbeat(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_employee_offline() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_employee_offline() FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_employee_offline() TO authenticated;

REVOKE ALL ON FUNCTION public.get_employee_online_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_employee_online_status() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_employee_online_status() TO authenticated;

COMMENT ON TABLE public.employee_online_heartbeats IS 'Best-effort app heartbeat presence. Visible only to admins/moderators through RLS/RPC.';
COMMENT ON FUNCTION public.get_employee_online_status() IS 'Returns online users from the last 2 minutes with safe profile and today attendance status for admins/moderators.';
