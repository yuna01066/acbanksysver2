BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Additive only: do not rewrite historical attendance, leave, or balances.
ALTER TABLE public.attendance_correction_requests
  ADD COLUMN IF NOT EXISTS attendance_before jsonb,
  ADD COLUMN IF NOT EXISTS attendance_after jsonb;

CREATE OR REPLACE FUNCTION public.submit_attendance_correction(
  _date date, _request_type text, _check_in timestamptz, _check_out timestamptz, _reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid := auth.uid();
  v_name text;
  v_record public.attendance_records%ROWTYPE;
  v_id uuid;
BEGIN
  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_user AND is_approved IS TRUE;
  IF v_user IS NULL OR NOT FOUND THEN RAISE EXCEPTION '승인된 직원만 신청할 수 있습니다.'; END IF;
  IF _date IS NULL OR _date > (now() AT TIME ZONE 'Asia/Seoul')::date
    OR _request_type IS NULL OR _request_type NOT IN ('check_in', 'check_out', 'both', 'memo')
    OR length(btrim(coalesce(_reason, ''))) < 3 THEN
    RAISE EXCEPTION '날짜, 정정 유형, 사유(3자 이상)를 확인해 주세요.';
  END IF;
  IF (_request_type IN ('check_in', 'both') AND _check_in IS NULL)
    OR (_request_type IN ('check_out', 'both') AND _check_out IS NULL) THEN
    RAISE EXCEPTION '정정할 시간을 입력해 주세요.';
  END IF;
  IF (_check_in IS NOT NULL AND (_check_in AT TIME ZONE 'Asia/Seoul')::date <> _date)
    OR (_check_out IS NOT NULL AND ((_check_out AT TIME ZONE 'Asia/Seoul')::date < _date
      OR (_check_out AT TIME ZONE 'Asia/Seoul')::date > _date + 1))
    OR (_check_in IS NOT NULL AND _check_out IS NOT NULL AND _check_out <= _check_in) THEN
    RAISE EXCEPTION '정정 시간과 근무일의 순서를 확인해 주세요.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || _date::text, 0));
  IF EXISTS (SELECT 1 FROM public.attendance_correction_requests WHERE user_id = v_user AND date = _date AND status = 'pending') THEN
    RAISE EXCEPTION '같은 날짜에 처리 대기 중인 정정 요청이 있습니다.';
  END IF;
  SELECT * INTO v_record FROM public.attendance_records WHERE user_id = v_user AND date = _date;
  INSERT INTO public.attendance_correction_requests
    (user_id, user_name, attendance_record_id, date, request_type, requested_check_in, requested_check_out, reason)
  VALUES (v_user, coalesce(v_name, '직원'), v_record.id, _date, _request_type,
    CASE WHEN _request_type IN ('check_in', 'both') THEN _check_in END,
    CASE WHEN _request_type IN ('check_out', 'both') THEN _check_out END, btrim(_reason))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_attendance_correction(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_approved IS TRUE
  ) THEN RAISE EXCEPTION '승인된 직원만 요청을 철회할 수 있습니다.'; END IF;
  UPDATE public.attendance_correction_requests SET status = 'cancelled'
  WHERE id = _request_id AND user_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION '이미 처리되었거나 철회할 수 없는 요청입니다.'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_attendance_correction(
  _request_id uuid, _decision text, _note text,
  _expected_request_updated_at timestamptz,
  _expected_record_id uuid, _expected_record_updated_at timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_request public.attendance_correction_requests%ROWTYPE;
  v_before public.attendance_records%ROWTYPE;
  v_after public.attendance_records%ROWTYPE;
  v_check_in timestamptz;
  v_check_out timestamptz;
  v_memo text;
  v_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_approved IS TRUE
  ) OR NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')) THEN
    RAISE EXCEPTION '근태 관리 권한이 필요합니다.';
  END IF;
  IF _decision IS NULL OR _decision NOT IN ('handled', 'rejected')
    OR length(btrim(coalesce(_note, ''))) < 3 THEN
    RAISE EXCEPTION '처리 결과와 사유(3자 이상)를 입력해 주세요.';
  END IF;
  SELECT * INTO v_request FROM public.attendance_correction_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND OR v_request.status <> 'pending' THEN RAISE EXCEPTION '이미 처리되었거나 없는 요청입니다.'; END IF;
  IF v_request.updated_at IS DISTINCT FROM _expected_request_updated_at THEN
    RAISE EXCEPTION '요청이 변경되었습니다. 새로고침 후 다시 검토해 주세요.';
  END IF;
  IF _decision = 'handled' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_request.user_id::text || ':' || v_request.date::text, 0));
    SELECT * INTO v_before FROM public.attendance_records
      WHERE user_id = v_request.user_id AND date = v_request.date FOR UPDATE;
    IF v_before.id IS DISTINCT FROM _expected_record_id
      OR v_before.updated_at IS DISTINCT FROM _expected_record_updated_at
      OR (v_request.attendance_record_id IS NOT NULL AND v_request.attendance_record_id IS DISTINCT FROM v_before.id) THEN
      RAISE EXCEPTION '근태 기록이 변경되었습니다. 새로고침 후 다시 검토해 주세요.';
    END IF;
    IF v_request.date > (now() AT TIME ZONE 'Asia/Seoul')::date THEN RAISE EXCEPTION '미래 근태는 정정할 수 없습니다.'; END IF;
    v_check_in := CASE WHEN v_request.request_type IN ('check_in', 'both') THEN v_request.requested_check_in ELSE v_before.check_in END;
    v_check_out := CASE WHEN v_request.request_type IN ('check_out', 'both') THEN v_request.requested_check_out ELSE v_before.check_out END;
    IF (v_request.request_type IN ('check_in', 'both') AND v_check_in IS NULL)
      OR (v_request.request_type IN ('check_out', 'both') AND v_check_out IS NULL)
      OR (v_check_out IS NOT NULL AND (v_check_in IS NULL OR v_check_out <= v_check_in))
      OR (v_check_in IS NOT NULL AND (v_check_in AT TIME ZONE 'Asia/Seoul')::date <> v_request.date)
      OR (v_check_out IS NOT NULL AND (v_check_out AT TIME ZONE 'Asia/Seoul')::date > v_request.date + 1) THEN
      RAISE EXCEPTION '최종 출퇴근 시간의 순서를 확인해 주세요.';
    END IF;
    IF v_request.request_type = 'memo' AND v_before.id IS NULL THEN RAISE EXCEPTION '메모 정정은 기존 근태 기록이 필요합니다.'; END IF;
    v_status := CASE WHEN v_before.status IN ('late', 'early_leave') THEN v_before.status
      WHEN v_check_out IS NOT NULL THEN 'checked_out' WHEN v_check_in IS NOT NULL THEN 'checked_in' ELSE v_before.status END;
    v_memo := concat_ws(E'\n', nullif(v_before.memo, ''), '[정정] ' || v_request.reason || ' / ' || btrim(_note));
    IF v_before.id IS NULL THEN
      INSERT INTO public.attendance_records(user_id, user_name, date, check_in, check_out, status, memo)
      VALUES (v_request.user_id, v_request.user_name, v_request.date, v_check_in, v_check_out, v_status, v_memo)
      RETURNING * INTO v_after;
    ELSE
      UPDATE public.attendance_records SET check_in = v_check_in, check_out = v_check_out, status = v_status, memo = v_memo
      WHERE id = v_before.id RETURNING * INTO v_after;
    END IF;
  END IF;
  UPDATE public.attendance_correction_requests
  SET status = _decision, handled_by = auth.uid(), handled_at = now(), handled_memo = btrim(_note),
    attendance_before = CASE WHEN v_before.id IS NOT NULL THEN jsonb_build_object('id', v_before.id, 'check_in', v_before.check_in, 'check_out', v_before.check_out, 'status', v_before.status, 'memo', v_before.memo) END,
    attendance_after = CASE WHEN v_after.id IS NOT NULL THEN jsonb_build_object('id', v_after.id, 'check_in', v_after.check_in, 'check_out', v_after.check_out, 'status', v_after.status, 'memo', v_after.memo) END,
    attendance_record_id = coalesce(v_after.id, attendance_record_id)
  WHERE id = _request_id;
  INSERT INTO public.notifications(user_id, type, title, description, data)
  VALUES (v_request.user_id, 'system', '근태 정정 ' || CASE WHEN _decision = 'handled' THEN '완료' ELSE '반려' END,
    v_request.date::text || ' · ' || btrim(_note), jsonb_build_object('requestId', _request_id, 'url', '/attendance?scope=my&tab=attendance'));
END;
$$;

-- All status transitions go through authenticated RPCs, not user-supplied rows.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'attendance_correction_requests' AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
  LOOP EXECUTE format('DROP POLICY %I ON public.attendance_correction_requests', p.policyname); END LOOP;
END;
$$;
REVOKE ALL ON public.attendance_correction_requests FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.attendance_correction_requests FROM authenticated;
GRANT SELECT ON public.attendance_correction_requests TO authenticated;

REVOKE ALL ON FUNCTION public.submit_attendance_correction(date, text, timestamptz, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_attendance_correction(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_attendance_correction(uuid, text, text, timestamptz, uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_attendance_correction(date, text, timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_attendance_correction(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_attendance_correction(uuid, text, text, timestamptz, uuid, timestamptz) TO authenticated;

-- Keep policy reads; only administrators may change company-wide leave rules.
DROP POLICY IF EXISTS "Moderators can manage leave policies" ON public.leave_policy_settings;
DROP POLICY IF EXISTS "Moderators can manage leave general settings" ON public.leave_general_settings;

DROP POLICY IF EXISTS "Moderators can manage company holidays" ON public.company_holidays;

COMMIT;