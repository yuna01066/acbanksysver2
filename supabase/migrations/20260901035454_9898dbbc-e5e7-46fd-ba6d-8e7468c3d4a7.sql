CREATE OR REPLACE FUNCTION public.confirm_public_booking_request(_request_id uuid, _reviewer_id uuid DEFAULT NULL::uuid, _review_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request public.public_booking_requests%ROWTYPE;
  v_link public.public_booking_links%ROWTYPE;
  v_resource public.calendar_resources%ROWTYPE;
  v_conflict text;
  v_user_conflict text;
  v_event_id uuid;
  v_title text;
  v_description text;
  v_location text;
  v_review_note text;
BEGIN
  SELECT * INTO v_request FROM public.public_booking_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '예약 요청을 찾을 수 없습니다.'; END IF;
  IF v_request.status <> 'pending_review' THEN RAISE EXCEPTION '확정할 수 있는 예약 요청이 아닙니다.'; END IF;

  SELECT * INTO v_link FROM public.public_booking_links WHERE id = v_request.link_id;
  IF NOT FOUND THEN RAISE EXCEPTION '예약 링크를 찾을 수 없습니다.'; END IF;

  IF v_link.link_type <> 'consultation_booking' AND v_request.resource_id IS NULL THEN
    RAISE EXCEPTION '회의실 예약에는 회의실이 필요합니다.';
  END IF;

  IF v_link.link_type = 'consultation_booking' AND v_request.meeting_mode = 'visit' AND v_request.resource_id IS NULL THEN
    RAISE EXCEPTION '방문 상담 예약에는 회의실이 필요합니다.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      concat_ws(':', 'public_booking',
        COALESCE(v_request.resource_id::text, 'no-resource'),
        COALESCE(v_request.assigned_to::text, 'no-user'),
        v_request.starts_at::text, v_request.ends_at::text),
      0)
  );

  IF v_request.resource_id IS NOT NULL THEN
    SELECT * INTO v_resource FROM public.calendar_resources WHERE id = v_request.resource_id AND is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION '예약 가능한 회의실을 찾을 수 없습니다.'; END IF;

    SELECT public.get_calendar_resource_conflict(ARRAY[v_request.resource_id], v_request.starts_at, v_request.ends_at, NULL) INTO v_conflict;
    IF v_conflict IS NOT NULL THEN RAISE EXCEPTION '이미 예약된 회의실입니다: %', v_conflict; END IF;
  END IF;

  IF v_request.assigned_to IS NOT NULL THEN
    SELECT public.get_calendar_user_conflict(ARRAY[v_request.assigned_to], v_request.starts_at, v_request.ends_at, NULL) INTO v_user_conflict;
    IF v_user_conflict IS NOT NULL THEN RAISE EXCEPTION '이미 예약된 담당자입니다: %', v_user_conflict; END IF;
  END IF;

  v_title := CASE
    WHEN v_link.link_type = 'partner_room' THEN '공유회사 회의실 예약 · ' || COALESCE(v_request.company_name, v_request.requester_name)
    WHEN v_link.link_type = 'consultation_booking' THEN '고객 상담 예약 · ' || COALESCE(v_request.company_name, v_request.requester_name)
    ELSE '외부 고객 미팅 · ' || COALESCE(v_request.company_name, v_request.requester_name)
  END;

  v_location := CASE
    WHEN v_request.resource_id IS NOT NULL THEN COALESCE(v_resource.name, '회의실')
    WHEN v_request.meeting_mode = 'phone' THEN '전화 상담'
    WHEN v_request.meeting_mode = 'online' THEN '온라인 상담'
    ELSE NULL
  END;

  v_description := concat_ws(E'\n',
    NULLIF(v_request.purpose, ''), NULLIF(v_request.notes, ''),
    CASE WHEN v_request.phone IS NOT NULL THEN '연락처: ' || v_request.phone ELSE NULL END,
    CASE WHEN v_request.email IS NOT NULL THEN '이메일: ' || v_request.email ELSE NULL END);

  INSERT INTO public.calendar_events (
    title, description, starts_at, ends_at, all_day, location, visibility, status,
    created_by, source_type, source_id, source_subtype, source_path, accent, icon_type,
    created_by_name, client_name, client_contact, metadata
  ) VALUES (
    v_title, NULLIF(v_description, ''), v_request.starts_at, v_request.ends_at,
    false, v_location, 'title_only', 'confirmed',
    COALESCE(_reviewer_id, v_request.assigned_to),
    'external_booking', v_request.id, v_link.link_type,
    '/meeting-reservations?tab=public',
    CASE WHEN v_link.link_type = 'consultation_booking' THEN '#14b8a6' ELSE '#38bdf8' END,
    CASE WHEN v_link.link_type = 'consultation_booking' THEN 'meeting' ELSE 'meeting_room' END,
    '외부 예약',
    COALESCE(v_request.company_name, v_request.requester_name),
    COALESCE(v_request.phone, v_request.email),
    jsonb_strip_nulls(jsonb_build_object(
      'publicBookingRequestId', v_request.id,
      'publicBookingLinkId', v_link.id,
      'publicBookingLinkSlug', v_link.slug,
      'publicBookingLinkType', v_link.link_type,
      'consultationLeadId', v_request.consultation_lead_id,
      'assignedTo', v_request.assigned_to,
      'meetingMode', v_request.meeting_mode,
      'requesterName', v_request.requester_name,
      'companyName', v_request.company_name,
      'clientContact', COALESCE(v_request.phone, v_request.email),
      'public_schedule_company_name', NULLIF(v_request.company_name, ''),
      'public_schedule_purpose', NULLIF(v_request.purpose, '')
    ))
  ) RETURNING id INTO v_event_id;

  IF v_request.resource_id IS NOT NULL THEN
    INSERT INTO public.calendar_event_resources (event_id, resource_id) VALUES (v_event_id, v_request.resource_id);
  END IF;

  IF v_request.assigned_to IS NOT NULL THEN
    INSERT INTO public.calendar_event_participants (event_id, user_id, role, response_status)
    VALUES (v_event_id, v_request.assigned_to, 'assignee', 'accepted')
    ON CONFLICT (event_id, user_id, role) DO UPDATE SET role = EXCLUDED.role, response_status = EXCLUDED.response_status;
  END IF;

  v_review_note := COALESCE(NULLIF(_review_note, ''), '예약 확정');

  UPDATE public.public_booking_requests
  SET status = 'confirmed', calendar_event_id = v_event_id, reviewed_by = _reviewer_id,
      reviewed_at = now(), review_note = v_review_note, updated_at = now()
  WHERE id = v_request.id;

  IF v_request.consultation_lead_id IS NOT NULL THEN
    UPDATE public.client_consultation_leads
    SET public_booking_request_id = v_request.id,
        assigned_to = COALESCE(assigned_to, v_request.assigned_to),
        assigned_at = CASE WHEN assigned_to IS NULL AND v_request.assigned_to IS NOT NULL THEN now() ELSE assigned_at END,
        follow_up_at = v_request.starts_at,
        status = CASE WHEN status IN ('closed', 'converted') THEN status ELSE 'needs_review' END,
        memo = concat_ws(E'\n', NULLIF(memo, ''),
          '시스템: 상담 예약이 확정되었습니다. ' || to_char(v_request.starts_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI')),
        updated_at = now()
    WHERE id = v_request.consultation_lead_id;
  END IF;

  RETURN v_event_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_public_booking_from_calendar_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id uuid;
  v_reason text;
  v_request public.public_booking_requests%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_event_id := OLD.id;
    v_reason := '내부 캘린더 일정 삭제로 예약이 취소되었습니다.';
  ELSE
    IF NEW.status <> 'canceled' OR COALESCE(OLD.status, '') = 'canceled' THEN
      RETURN NEW;
    END IF;
    v_event_id := NEW.id;
    v_reason := '내부 캘린더 일정 취소로 예약이 취소되었습니다.';
  END IF;

  SELECT * INTO v_request
  FROM public.public_booking_requests
  WHERE calendar_event_id = v_event_id AND status = 'confirmed'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  UPDATE public.public_booking_requests
  SET status = 'canceled',
      calendar_event_id = NULL,
      review_note = v_reason,
      updated_at = now()
  WHERE id = v_request.id;

  INSERT INTO public.public_booking_request_events (
    request_id, link_id, event_type, from_status, to_status, actor_id, note, metadata
  ) VALUES (
    v_request.id, v_request.link_id, 'canceled', 'confirmed', 'canceled',
    auth.uid(), v_reason,
    jsonb_build_object('calendarEventId', v_event_id, 'trigger', TG_OP)
  );

  DELETE FROM public.public_booking_schedule_cache WHERE link_id = v_request.link_id;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_public_booking_from_calendar_event_del ON public.calendar_events;
CREATE TRIGGER trg_sync_public_booking_from_calendar_event_del
BEFORE DELETE ON public.calendar_events
FOR EACH ROW
WHEN (OLD.source_type = 'external_booking')
EXECUTE FUNCTION public.sync_public_booking_from_calendar_event();

DROP TRIGGER IF EXISTS trg_sync_public_booking_from_calendar_event_upd ON public.calendar_events;
CREATE TRIGGER trg_sync_public_booking_from_calendar_event_upd
AFTER UPDATE OF status ON public.calendar_events
FOR EACH ROW
WHEN (NEW.source_type = 'external_booking')
EXECUTE FUNCTION public.sync_public_booking_from_calendar_event();

DO $repair$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT pr.id, pr.reviewed_by, pr.review_note
    FROM public.public_booking_requests pr
    LEFT JOIN public.calendar_events ce ON ce.id = pr.calendar_event_id
    WHERE pr.status = 'confirmed'
      AND (pr.calendar_event_id IS NULL OR ce.id IS NULL OR ce.status = 'canceled')
      AND pr.ends_at > now() - interval '30 days'
  LOOP
    BEGIN
      UPDATE public.public_booking_requests SET status = 'pending_review' WHERE id = r.id;
      PERFORM public.confirm_public_booking_request(r.id, r.reviewed_by, COALESCE(NULLIF(r.review_note, ''), '내부 캘린더 동기화 복구'));
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.public_booking_requests SET status = 'confirmed' WHERE id = r.id;
      RAISE NOTICE 'public booking calendar repair skipped for %: %', r.id, SQLERRM;
    END;
  END LOOP;
END
$repair$;