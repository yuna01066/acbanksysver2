
-- 출퇴근 기록 테이블
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  check_in TIMESTAMP WITH TIME ZONE,
  check_out TIMESTAMP WITH TIME ZONE,
  check_in_location JSONB, -- { lat, lng, address }
  check_out_location JSONB,
  work_hours NUMERIC GENERATED ALWAYS AS (
    CASE WHEN check_in IS NOT NULL AND check_out IS NOT NULL
      THEN EXTRACT(EPOCH FROM (check_out - check_in)) / 3600.0
      ELSE NULL
    END
  ) STORED,
  status TEXT NOT NULL DEFAULT 'checked_in', -- checked_in, checked_out, late, absent
  memo TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own attendance"
ON public.attendance_records FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all attendance"
ON public.attendance_records FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can view all attendance"
ON public.attendance_records FOR SELECT
USING (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Users can insert their own attendance"
ON public.attendance_records FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attendance"
ON public.attendance_records FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can update all attendance"
ON public.attendance_records FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_attendance_user_date ON public.attendance_records (user_id, date DESC);

-- 휴가/연차 신청 테이블
CREATE TABLE public.leave_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  leave_type TEXT NOT NULL DEFAULT 'annual', -- annual, half_day, sick, personal, other
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days NUMERIC NOT NULL DEFAULT 1,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  approved_by UUID,
  approved_by_name TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  reject_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own leave requests"
ON public.leave_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all leave requests"
ON public.leave_requests FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can view all leave requests"
ON public.leave_requests FOR SELECT
USING (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Users can insert their own leave requests"
ON public.leave_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending leave requests"
ON public.leave_requests FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can update all leave requests"
ON public.leave_requests FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can update all leave requests"
ON public.leave_requests FOR UPDATE
USING (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Users can delete their own pending leave requests"
ON public.leave_requests FOR DELETE
USING (auth.uid() = user_id AND status = 'pending');

CREATE INDEX idx_leave_user_date ON public.leave_requests (user_id, start_date DESC);

-- Enable realtime for attendance
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;
