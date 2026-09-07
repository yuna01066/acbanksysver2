BEGIN;

INSERT INTO public.page_role_access (page_key, min_role)
VALUES
  ('/tax-invoice-reliability', 'admin'),
  ('/edge-function-status', 'admin'),
  ('/public-booking-approvals', 'moderator'),
  ('/public-booking-share', 'moderator'),
  ('/notification-center', 'employee')
ON CONFLICT (page_key) DO UPDATE SET min_role = EXCLUDED.min_role;

-- Keep legacy aliases readable while all new writes use one canonical key.
UPDATE public.leave_requests
SET leave_type = CASE leave_type
  WHEN 'half_day_am' THEN 'half_am'
  WHEN 'half_day_pm' THEN 'half_pm'
  ELSE leave_type
END
WHERE leave_type IN ('half_day_am', 'half_day_pm');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.leave_requests
    WHERE status NOT IN ('pending', 'approved', 'rejected', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'leave_requests has unsupported status values';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.leave_requests
    WHERE end_date < start_date OR days <= 0 OR btrim(leave_type) = ''
  ) THEN
    RAISE EXCEPTION 'leave_requests has invalid dates, days, or leave_type values';
  END IF;
END;
$$;

ALTER TABLE public.leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_status_check,
  DROP CONSTRAINT IF EXISTS leave_requests_date_order_check,
  DROP CONSTRAINT IF EXISTS leave_requests_days_positive_check,
  DROP CONSTRAINT IF EXISTS leave_requests_type_present_check;

ALTER TABLE public.leave_requests
  ADD CONSTRAINT leave_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  ADD CONSTRAINT leave_requests_date_order_check CHECK (end_date >= start_date),
  ADD CONSTRAINT leave_requests_days_positive_check CHECK (days > 0),
  ADD CONSTRAINT leave_requests_type_present_check CHECK (btrim(leave_type) <> '');

CREATE TABLE public.leave_cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id UUID NOT NULL REFERENCES public.leave_requests(id) ON DELETE RESTRICT,
  requested_by UUID NOT NULL,
  requested_by_name TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (btrim(reason) <> ''),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID,
  reviewed_by_name TEXT,
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX leave_cancellation_requests_one_pending
  ON public.leave_cancellation_requests(leave_request_id)
  WHERE status = 'pending';
CREATE INDEX leave_cancellation_requests_status_created
  ON public.leave_cancellation_requests(status, created_at DESC);

ALTER TABLE public.leave_cancellation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leave cancellation participants can view requests"
ON public.leave_cancellation_requests
FOR SELECT TO authenticated
USING (
  requested_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.leave_requests leave_request
    WHERE leave_request.id = leave_request_id
      AND leave_request.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

GRANT SELECT ON public.leave_cancellation_requests TO authenticated;
REVOKE ALL ON public.leave_cancellation_requests FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.leave_cancellation_requests FROM authenticated;

DROP TRIGGER IF EXISTS update_leave_cancellation_requests_updated_at
ON public.leave_cancellation_requests;
CREATE TRIGGER update_leave_cancellation_requests_updated_at
BEFORE UPDATE ON public.leave_cancellation_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- A single database calculation prevents forged balances and keeps holidays consistent.
CREATE OR REPLACE FUNCTION public.calculate_leave_business_days(
  _leave_type TEXT,
  _start_date DATE,
  _end_date DATE
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_days NUMERIC;
  v_type TEXT := CASE _leave_type
    WHEN 'half_day_am' THEN 'half_am'
    WHEN 'half_day_pm' THEN 'half_pm'
    ELSE btrim(_leave_type)
  END;
BEGIN
  IF _start_date IS NULL OR _end_date IS NULL OR _end_date < _start_date THEN
    RAISE EXCEPTION '휴가 시작일과 종료일을 확인해 주세요.';
  END IF;
  IF v_type IS NULL OR v_type = '' THEN
    RAISE EXCEPTION '휴가 유형을 선택해 주세요.';
  END IF;

  SELECT count(*)::NUMERIC INTO v_days
  FROM generate_series(_start_date, _end_date, INTERVAL '1 day') AS day_series(day_value)
  WHERE extract(isodow FROM day_value) < 6
    AND NOT EXISTS (
      SELECT 1 FROM public.company_holidays holiday
      WHERE day_value::DATE BETWEEN holiday.start_date AND holiday.end_date
    );

  IF v_type IN ('half_am', 'half_pm') THEN
    IF _start_date <> _end_date OR v_days <> 1 THEN
      RAISE EXCEPTION '반차는 근무일 하루만 선택할 수 있습니다.';
    END IF;
    RETURN 0.5;
  END IF;

  IF v_days <= 0 THEN
    RAISE EXCEPTION '선택한 기간에 사용 가능한 근무일이 없습니다.';
  END IF;
  RETURN v_days;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_leave_reviewers(
  _type TEXT,
  _title TEXT,
  _description TEXT,
  _data JSONB,
  _dedupe_key TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.notifications (user_id, type, title, description, data, dedupe_key)
  SELECT DISTINCT role_row.user_id, _type, _title, _description, _data, _dedupe_key
  FROM public.user_roles role_row
  WHERE role_row.role IN ('admin'::public.app_role, 'moderator'::public.app_role)
  ON CONFLICT (user_id, type, dedupe_key) DO UPDATE
  SET title = EXCLUDED.title,
      description = EXCLUDED.description,
      data = EXCLUDED.data,
      is_read = false;
$$;

CREATE OR REPLACE FUNCTION public.submit_leave_request(
  _leave_type TEXT,
  _start_date DATE,
  _end_date DATE,
  _reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_name TEXT;
  v_leave_type TEXT := CASE _leave_type
    WHEN 'half_day_am' THEN 'half_am'
    WHEN 'half_day_pm' THEN 'half_pm'
    ELSE btrim(_leave_type)
  END;
  v_days NUMERIC;
  v_request_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;
  v_user_name := public.get_profile_display_name(v_user_id);
  IF v_user_name IS NULL THEN RAISE EXCEPTION '직원 프로필을 찾을 수 없습니다.'; END IF;
  v_days := public.calculate_leave_business_days(v_leave_type, _start_date, _end_date);

  INSERT INTO public.leave_requests (
    user_id, user_name, leave_type, start_date, end_date, days, reason, status
  ) VALUES (
    v_user_id, v_user_name, v_leave_type, _start_date, _end_date, v_days,
    NULLIF(btrim(_reason), ''), 'pending'
  ) RETURNING id INTO v_request_id;

  PERFORM public.notify_leave_reviewers(
    'leave_request', '휴가 승인 요청',
    format('%s님이 %s일의 휴가를 신청했습니다.', v_user_name, v_days),
    jsonb_build_object('leaveRequestId', v_request_id),
    'leave-request:' || v_request_id::TEXT
  );
  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_leave_request(
  _request_id UUID,
  _decision TEXT,
  _reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reviewer UUID := auth.uid();
  v_reviewer_name TEXT;
  v_leave public.leave_requests;
BEGIN
  IF v_reviewer IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;
  IF NOT (
    public.has_role(v_reviewer, 'admin'::public.app_role)
    OR public.has_role(v_reviewer, 'moderator'::public.app_role)
  ) THEN RAISE EXCEPTION '휴가를 승인할 권한이 없습니다.'; END IF;
  IF _decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION '승인 또는 반려만 선택할 수 있습니다.';
  END IF;
  IF _decision = 'rejected' AND NULLIF(btrim(_reason), '') IS NULL THEN
    RAISE EXCEPTION '반려 사유를 입력해 주세요.';
  END IF;

  SELECT * INTO v_leave FROM public.leave_requests
  WHERE id = _request_id FOR UPDATE;
  IF v_leave.id IS NULL THEN RAISE EXCEPTION '휴가 신청을 찾을 수 없습니다.'; END IF;
  IF v_leave.status <> 'pending' THEN RAISE EXCEPTION '대기 중인 휴가만 처리할 수 있습니다.'; END IF;

  v_reviewer_name := public.get_profile_display_name(v_reviewer);
  UPDATE public.leave_requests
  SET status = _decision,
      approved_by = v_reviewer,
      approved_by_name = v_reviewer_name,
      approved_at = now(),
      reject_reason = CASE WHEN _decision = 'rejected' THEN btrim(_reason) ELSE NULL END,
      updated_at = now()
  WHERE id = _request_id;

  INSERT INTO public.notifications (user_id, type, title, description, data, dedupe_key)
  VALUES (
    v_leave.user_id,
    CASE WHEN _decision = 'approved' THEN 'leave_approved' ELSE 'leave_rejected' END,
    CASE WHEN _decision = 'approved' THEN '휴가 승인 완료' ELSE '휴가 신청 반려' END,
    CASE WHEN _decision = 'approved'
      THEN format('%s ~ %s 휴가가 승인되었습니다.', v_leave.start_date, v_leave.end_date)
      ELSE format('휴가가 반려되었습니다. 사유: %s', btrim(_reason)) END,
    jsonb_build_object('leaveRequestId', _request_id),
    'leave-review:' || _request_id::TEXT
  )
  ON CONFLICT (user_id, type, dedupe_key) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      data = EXCLUDED.data, is_read = false;
  RETURN _request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_pending_leave_request(_request_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_leave public.leave_requests;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;
  SELECT * INTO v_leave FROM public.leave_requests
  WHERE id = _request_id FOR UPDATE;
  IF v_leave.id IS NULL THEN RAISE EXCEPTION '휴가 신청을 찾을 수 없습니다.'; END IF;
  IF v_leave.user_id <> v_user_id THEN RAISE EXCEPTION '본인의 휴가만 취소할 수 있습니다.'; END IF;
  IF v_leave.status <> 'pending' THEN RAISE EXCEPTION '대기 중인 휴가만 바로 취소할 수 있습니다.'; END IF;

  UPDATE public.leave_requests
  SET status = 'cancelled', updated_at = now()
  WHERE id = _request_id;
  RETURN _request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_leave_cancellation(
  _leave_request_id UUID,
  _reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_name TEXT;
  v_leave public.leave_requests;
  v_cancellation_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;
  IF NULLIF(btrim(_reason), '') IS NULL THEN RAISE EXCEPTION '취소 사유를 입력해 주세요.'; END IF;

  SELECT * INTO v_leave FROM public.leave_requests
  WHERE id = _leave_request_id FOR UPDATE;
  IF v_leave.id IS NULL THEN RAISE EXCEPTION '휴가 신청을 찾을 수 없습니다.'; END IF;
  IF v_leave.user_id <> v_user_id THEN RAISE EXCEPTION '본인의 휴가만 취소 요청할 수 있습니다.'; END IF;
  IF v_leave.status <> 'approved' THEN RAISE EXCEPTION '승인된 휴가만 취소 요청할 수 있습니다.'; END IF;
  IF v_leave.start_date <= (now() AT TIME ZONE 'Asia/Seoul')::DATE THEN
    RAISE EXCEPTION '당일 또는 지난 휴가는 관리자에게 문의해 주세요.';
  END IF;

  v_user_name := public.get_profile_display_name(v_user_id);
  INSERT INTO public.leave_cancellation_requests (
    leave_request_id, requested_by, requested_by_name, reason
  ) VALUES (
    _leave_request_id, v_user_id, v_user_name, btrim(_reason)
  ) RETURNING id INTO v_cancellation_id;

  PERFORM public.notify_leave_reviewers(
    'leave_cancellation_request', '휴가 취소 승인 요청',
    format('%s님이 %s ~ %s 휴가 취소를 요청했습니다.', v_user_name, v_leave.start_date, v_leave.end_date),
    jsonb_build_object('leaveRequestId', _leave_request_id, 'cancellationRequestId', v_cancellation_id),
    'leave-cancellation:' || v_cancellation_id::TEXT
  );
  RETURN v_cancellation_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION '이미 처리 대기 중인 취소 요청이 있습니다.';
END;
$$;

CREATE OR REPLACE FUNCTION public.review_leave_cancellation(
  _cancellation_id UUID,
  _decision TEXT,
  _review_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reviewer UUID := auth.uid();
  v_reviewer_name TEXT;
  v_cancellation public.leave_cancellation_requests;
  v_leave public.leave_requests;
BEGIN
  IF v_reviewer IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;
  IF NOT (
    public.has_role(v_reviewer, 'admin'::public.app_role)
    OR public.has_role(v_reviewer, 'moderator'::public.app_role)
  ) THEN RAISE EXCEPTION '휴가 취소를 처리할 권한이 없습니다.'; END IF;
  IF _decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION '승인 또는 반려만 선택할 수 있습니다.';
  END IF;
  IF _decision = 'rejected' AND NULLIF(btrim(_review_note), '') IS NULL THEN
    RAISE EXCEPTION '취소 반려 사유를 입력해 주세요.';
  END IF;

  SELECT * INTO v_cancellation FROM public.leave_cancellation_requests
  WHERE id = _cancellation_id FOR UPDATE;
  IF v_cancellation.id IS NULL THEN RAISE EXCEPTION '휴가 취소 요청을 찾을 수 없습니다.'; END IF;
  IF v_cancellation.status <> 'pending' THEN RAISE EXCEPTION '대기 중인 취소 요청만 처리할 수 있습니다.'; END IF;

  SELECT * INTO v_leave FROM public.leave_requests
  WHERE id = v_cancellation.leave_request_id FOR UPDATE;
  IF v_leave.id IS NULL OR v_leave.status <> 'approved' THEN
    RAISE EXCEPTION '원본 휴가가 승인 상태가 아닙니다.';
  END IF;

  v_reviewer_name := public.get_profile_display_name(v_reviewer);
  UPDATE public.leave_cancellation_requests
  SET status = _decision,
      reviewed_by = v_reviewer,
      reviewed_by_name = v_reviewer_name,
      review_note = NULLIF(btrim(_review_note), ''),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = _cancellation_id;

  IF _decision = 'approved' THEN
    UPDATE public.leave_requests
    SET status = 'cancelled', updated_at = now()
    WHERE id = v_leave.id;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, description, data, dedupe_key)
  VALUES (
    v_leave.user_id,
    CASE WHEN _decision = 'approved' THEN 'leave_cancellation_approved' ELSE 'leave_cancellation_rejected' END,
    CASE WHEN _decision = 'approved' THEN '휴가 취소 승인' ELSE '휴가 취소 반려' END,
    CASE WHEN _decision = 'approved'
      THEN format('%s ~ %s 휴가가 취소되었습니다.', v_leave.start_date, v_leave.end_date)
      ELSE format('휴가 취소 요청이 반려되었습니다. 사유: %s', btrim(_review_note)) END,
    jsonb_build_object('leaveRequestId', v_leave.id, 'cancellationRequestId', _cancellation_id),
    'leave-cancellation-review:' || _cancellation_id::TEXT
  )
  ON CONFLICT (user_id, type, dedupe_key) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      data = EXCLUDED.data, is_read = false;
  RETURN _cancellation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_leave(
  _leave_request_id UUID,
  _reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reviewer UUID := auth.uid();
  v_reviewer_name TEXT;
  v_leave public.leave_requests;
  v_cancellation_id UUID;
BEGIN
  IF v_reviewer IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;
  IF NOT (
    public.has_role(v_reviewer, 'admin'::public.app_role)
    OR public.has_role(v_reviewer, 'moderator'::public.app_role)
  ) THEN RAISE EXCEPTION '휴가를 취소할 권한이 없습니다.'; END IF;
  IF NULLIF(btrim(_reason), '') IS NULL THEN RAISE EXCEPTION '관리자 취소 사유를 입력해 주세요.'; END IF;

  SELECT * INTO v_leave FROM public.leave_requests
  WHERE id = _leave_request_id FOR UPDATE;
  IF v_leave.id IS NULL THEN RAISE EXCEPTION '휴가 신청을 찾을 수 없습니다.'; END IF;
  IF v_leave.status <> 'approved' THEN RAISE EXCEPTION '승인된 휴가만 취소할 수 있습니다.'; END IF;
  v_reviewer_name := public.get_profile_display_name(v_reviewer);

  SELECT id INTO v_cancellation_id FROM public.leave_cancellation_requests
  WHERE leave_request_id = _leave_request_id AND status = 'pending'
  FOR UPDATE;

  IF v_cancellation_id IS NULL THEN
    INSERT INTO public.leave_cancellation_requests (
      leave_request_id, requested_by, requested_by_name, reason, status,
      reviewed_by, reviewed_by_name, review_note, reviewed_at
    ) VALUES (
      _leave_request_id, v_reviewer, v_reviewer_name, btrim(_reason), 'approved',
      v_reviewer, v_reviewer_name, btrim(_reason), now()
    ) RETURNING id INTO v_cancellation_id;
  ELSE
    UPDATE public.leave_cancellation_requests
    SET status = 'approved', reviewed_by = v_reviewer,
        reviewed_by_name = v_reviewer_name, review_note = btrim(_reason),
        reviewed_at = now(), updated_at = now()
    WHERE id = v_cancellation_id;
  END IF;

  UPDATE public.leave_requests
  SET status = 'cancelled', updated_at = now()
  WHERE id = _leave_request_id;

  INSERT INTO public.notifications (user_id, type, title, description, data, dedupe_key)
  VALUES (
    v_leave.user_id, 'leave_cancellation_approved', '휴가 관리자 취소',
    format('%s ~ %s 휴가가 취소되었습니다. 사유: %s', v_leave.start_date, v_leave.end_date, btrim(_reason)),
    jsonb_build_object('leaveRequestId', _leave_request_id, 'cancellationRequestId', v_cancellation_id),
    'leave-admin-cancel:' || _leave_request_id::TEXT
  )
  ON CONFLICT (user_id, type, dedupe_key) DO UPDATE
  SET title = EXCLUDED.title, description = EXCLUDED.description,
      data = EXCLUDED.data, is_read = false;
  RETURN v_cancellation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_leave_request(
  _user_id UUID,
  _leave_type TEXT,
  _start_date DATE,
  _end_date DATE,
  _reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reviewer UUID := auth.uid();
  v_reviewer_name TEXT;
  v_user_name TEXT;
  v_leave_type TEXT := CASE _leave_type
    WHEN 'half_day_am' THEN 'half_am'
    WHEN 'half_day_pm' THEN 'half_pm'
    ELSE btrim(_leave_type)
  END;
  v_days NUMERIC;
  v_request_id UUID;
BEGIN
  IF v_reviewer IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.'; END IF;
  IF NOT (
    public.has_role(v_reviewer, 'admin'::public.app_role)
    OR public.has_role(v_reviewer, 'moderator'::public.app_role)
  ) THEN RAISE EXCEPTION '휴가를 등록할 권한이 없습니다.'; END IF;

  v_user_name := public.get_profile_display_name(_user_id);
  IF v_user_name IS NULL THEN RAISE EXCEPTION '직원 프로필을 찾을 수 없습니다.'; END IF;
  v_reviewer_name := public.get_profile_display_name(v_reviewer);
  v_days := public.calculate_leave_business_days(v_leave_type, _start_date, _end_date);

  INSERT INTO public.leave_requests (
    user_id, user_name, leave_type, start_date, end_date, days, reason, status,
    approved_by, approved_by_name, approved_at
  ) VALUES (
    _user_id, v_user_name, v_leave_type, _start_date, _end_date, v_days,
    NULLIF(btrim(_reason), ''), 'approved', v_reviewer, v_reviewer_name, now()
  ) RETURNING id INTO v_request_id;

  INSERT INTO public.notifications (user_id, type, title, description, data, dedupe_key)
  VALUES (
    _user_id, 'leave_approved', '휴가 등록 완료',
    format('%s ~ %s 휴가가 관리자에 의해 등록되었습니다.', _start_date, _end_date),
    jsonb_build_object('leaveRequestId', v_request_id),
    'leave-admin-create:' || v_request_id::TEXT
  );
  RETURN v_request_id;
END;
$$;

-- All mutations now go through the locked, audited functions above.
DROP POLICY IF EXISTS "Users can insert their own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins can insert all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Moderators can insert all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can update their own pending leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins can update all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Moderators can update all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can delete their own pending leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins can delete all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Moderators can delete all leave requests" ON public.leave_requests;
-- Compatibility with a previously proposed combined policy name.
DROP POLICY IF EXISTS "Admins and moderators can delete leave requests" ON public.leave_requests;
REVOKE INSERT, UPDATE, DELETE ON public.leave_requests FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.calculate_leave_business_days(TEXT, DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notify_leave_reviewers(TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_leave_request(TEXT, DATE, DATE, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_leave_request(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_pending_leave_request(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_leave_cancellation(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_leave_cancellation(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_cancel_leave(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_leave_request(UUID, TEXT, DATE, DATE, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.calculate_leave_business_days(TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_leave_request(TEXT, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_leave_request(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_pending_leave_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_leave_cancellation(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_leave_cancellation(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_leave(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_leave_request(UUID, TEXT, DATE, DATE, TEXT) TO authenticated;

COMMENT ON TABLE public.leave_cancellation_requests IS
  'Auditable employee and administrator cancellation workflow for approved leave.';

COMMIT;
