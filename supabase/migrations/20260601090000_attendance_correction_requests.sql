CREATE TABLE IF NOT EXISTS public.attendance_correction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  attendance_record_id uuid REFERENCES public.attendance_records(id) ON DELETE SET NULL,
  date date NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('check_in', 'check_out', 'both', 'memo')),
  requested_check_in timestamptz,
  requested_check_out timestamptz,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'cancelled', 'handled', 'rejected')),
  handled_by uuid,
  handled_at timestamptz,
  handled_memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_correction_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own attendance correction requests" ON public.attendance_correction_requests;
CREATE POLICY "Users can view own attendance correction requests"
ON public.attendance_correction_requests
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all attendance correction requests" ON public.attendance_correction_requests;
CREATE POLICY "Admins can view all attendance correction requests"
ON public.attendance_correction_requests
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Moderators can view all attendance correction requests" ON public.attendance_correction_requests;
CREATE POLICY "Moderators can view all attendance correction requests"
ON public.attendance_correction_requests
FOR SELECT
USING (public.has_role(auth.uid(), 'moderator'::app_role));

DROP POLICY IF EXISTS "Users can create own attendance correction requests" ON public.attendance_correction_requests;
CREATE POLICY "Users can create own attendance correction requests"
ON public.attendance_correction_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "Users can cancel own pending attendance correction requests" ON public.attendance_correction_requests;
CREATE POLICY "Users can cancel own pending attendance correction requests"
ON public.attendance_correction_requests
FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

DROP POLICY IF EXISTS "Admins can manage attendance correction requests" ON public.attendance_correction_requests;
CREATE POLICY "Admins can manage attendance correction requests"
ON public.attendance_correction_requests
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Moderators can manage attendance correction requests" ON public.attendance_correction_requests;
CREATE POLICY "Moderators can manage attendance correction requests"
ON public.attendance_correction_requests
FOR ALL
USING (public.has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'moderator'::app_role));

CREATE INDEX IF NOT EXISTS idx_attendance_correction_user_date
ON public.attendance_correction_requests (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_correction_status_created
ON public.attendance_correction_requests (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.notify_admins_for_attendance_correction_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id uuid;
BEGIN
  FOR recipient_id IN
    SELECT DISTINCT user_id
    FROM public.user_roles
    WHERE role IN ('admin'::app_role, 'moderator'::app_role)
  LOOP
    INSERT INTO public.notifications (user_id, type, title, description, data)
    VALUES (
      recipient_id,
      'attendance_correction_request',
      '근태 정정 요청',
      NEW.user_name || '님이 ' || to_char(NEW.date, 'YYYY.MM.DD') || ' 근태 정정을 요청했습니다.',
      jsonb_build_object(
        'requestId', NEW.id,
        'userId', NEW.user_id,
        'date', NEW.date,
        'requestType', NEW.request_type,
        'attendanceRecordId', NEW.attendance_record_id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_admins_for_attendance_correction_request() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_admins_for_attendance_correction_request() FROM anon;
REVOKE ALL ON FUNCTION public.notify_admins_for_attendance_correction_request() FROM authenticated;

DROP TRIGGER IF EXISTS notify_admins_for_attendance_correction_request_trigger
ON public.attendance_correction_requests;

CREATE TRIGGER notify_admins_for_attendance_correction_request_trigger
AFTER INSERT ON public.attendance_correction_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_for_attendance_correction_request();

DROP TRIGGER IF EXISTS update_attendance_correction_requests_updated_at
ON public.attendance_correction_requests;

CREATE TRIGGER update_attendance_correction_requests_updated_at
BEFORE UPDATE ON public.attendance_correction_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
