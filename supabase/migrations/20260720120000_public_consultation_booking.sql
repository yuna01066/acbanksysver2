-- Public consultation booking: extend public booking links into login-free consultation reservations.

ALTER TABLE public.public_booking_links
  DROP CONSTRAINT IF EXISTS public_booking_links_type_check;

ALTER TABLE public.public_booking_links
  ADD CONSTRAINT public_booking_links_type_check
  CHECK (link_type IN ('customer_request', 'partner_room', 'consultation_booking'));

ALTER TABLE public.public_booking_links
  ADD COLUMN IF NOT EXISTS assigned_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS meeting_modes text[] NOT NULL DEFAULT ARRAY['visit']::text[];

ALTER TABLE public.public_booking_links
  DROP CONSTRAINT IF EXISTS public_booking_links_resource_check;

ALTER TABLE public.public_booking_links
  ADD CONSTRAINT public_booking_links_resource_check
  CHECK (
    link_type = 'consultation_booking'
    OR array_length(allowed_resource_ids, 1) IS NOT NULL
  );

ALTER TABLE public.public_booking_links
  DROP CONSTRAINT IF EXISTS public_booking_links_meeting_modes_check;

ALTER TABLE public.public_booking_links
  ADD CONSTRAINT public_booking_links_meeting_modes_check
  CHECK (
    array_length(meeting_modes, 1) IS NOT NULL
    AND meeting_modes <@ ARRAY['visit', 'phone', 'online']::text[]
    AND (
      link_type <> 'consultation_booking'
      OR NOT ('visit' = ANY(meeting_modes))
      OR array_length(allowed_resource_ids, 1) IS NOT NULL
    )
  );

ALTER TABLE public.public_booking_links
  DROP CONSTRAINT IF EXISTS public_booking_links_consultation_auto_assign_check;

ALTER TABLE public.public_booking_links
  ADD CONSTRAINT public_booking_links_consultation_auto_assign_check
  CHECK (
    link_type <> 'consultation_booking'
    OR requires_approval = true
    OR array_length(assigned_user_ids, 1) IS NOT NULL
  );

ALTER TABLE public.public_booking_requests
  ALTER COLUMN resource_id DROP NOT NULL;

ALTER TABLE public.public_booking_requests
  ADD COLUMN IF NOT EXISTS consultation_lead_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS meeting_mode text NOT NULL DEFAULT 'visit',
  ADD COLUMN IF NOT EXISTS contact_preference text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'public_booking_requests_consultation_lead_id_fkey'
  ) THEN
    ALTER TABLE public.public_booking_requests
      ADD CONSTRAINT public_booking_requests_consultation_lead_id_fkey
      FOREIGN KEY (consultation_lead_id)
      REFERENCES public.client_consultation_leads(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'public_booking_requests_assigned_to_fkey'
  ) THEN
    ALTER TABLE public.public_booking_requests
      ADD CONSTRAINT public_booking_requests_assigned_to_fkey
      FOREIGN KEY (assigned_to)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'public_booking_requests_meeting_mode_check'
  ) THEN
    ALTER TABLE public.public_booking_requests
      ADD CONSTRAINT public_booking_requests_meeting_mode_check
      CHECK (meeting_mode IN ('visit', 'phone', 'online'));
  END IF;
END $$;

ALTER TABLE public.client_consultation_leads
  ADD COLUMN IF NOT EXISTS public_booking_request_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_consultation_leads_public_booking_request_id_fkey'
  ) THEN
    ALTER TABLE public.client_consultation_leads
      ADD CONSTRAINT client_consultation_leads_public_booking_request_id_fkey
      FOREIGN KEY (public_booking_request_id)
      REFERENCES public.public_booking_requests(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.client_consultation_leads
  DROP CONSTRAINT IF EXISTS client_consultation_leads_source_check;

ALTER TABLE public.client_consultation_leads
  ADD CONSTRAINT client_consultation_leads_source_check
  CHECK (source IN ('imweb-acbankform', 'internal-test', 'manual', 'public-booking'));

CREATE INDEX IF NOT EXISTS idx_public_booking_links_assigned_users
  ON public.public_booking_links USING gin(assigned_user_ids);

CREATE INDEX IF NOT EXISTS idx_public_booking_requests_consultation_lead
  ON public.public_booking_requests(consultation_lead_id)
  WHERE consultation_lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_public_booking_requests_assigned_to
  ON public.public_booking_requests(assigned_to)
  WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_consultation_leads_public_booking_request
  ON public.client_consultation_leads(public_booking_request_id)
  WHERE public_booking_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_calendar_user_conflict(
  _user_ids uuid[],
  _starts_at timestamptz,
  _ends_at timestamptz,
  _exclude_event_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conflict_name text;
BEGIN
  IF _user_ids IS NULL OR array_length(_user_ids, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  WITH busy AS (
    SELECT COALESCE(pd.full_name, '담당자') AS name
    FROM public.calendar_events event
    LEFT JOIN public.profile_directory pd ON pd.id = event.created_by
    WHERE event.created_by = ANY(_user_ids)
      AND event.status <> 'canceled'
      AND (_exclude_event_id IS NULL OR event.id <> _exclude_event_id)
      AND tstzrange(event.starts_at, event.ends_at, '[)') && tstzrange(_starts_at, _ends_at, '[)')

    UNION ALL

    SELECT COALESCE(pd.full_name, '담당자') AS name
    FROM public.calendar_event_participants participant
    JOIN public.calendar_events event ON event.id = participant.event_id
    LEFT JOIN public.profile_directory pd ON pd.id = participant.user_id
    WHERE participant.user_id = ANY(_user_ids)
      AND event.status <> 'canceled'
      AND (_exclude_event_id IS NULL OR event.id <> _exclude_event_id)
      AND tstzrange(event.starts_at, event.ends_at, '[)') && tstzrange(_starts_at, _ends_at, '[)')
  )
  SELECT name
  INTO conflict_name
  FROM busy
  LIMIT 1;

  RETURN conflict_name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_calendar_user_conflict(uuid[], timestamptz, timestamptz, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_calendar_user_conflict(uuid[], timestamptz, timestamptz, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_calendar_user_conflict(uuid[], timestamptz, timestamptz, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_calendar_user_conflict(uuid[], timestamptz, timestamptz, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_public_booking_request(
  _request_id uuid,
  _reviewer_id uuid DEFAULT NULL,
  _review_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  SELECT *
  INTO v_request
  FROM public.public_booking_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '예약 요청을 찾을 수 없습니다.';
  END IF;

  IF v_request.status <> 'pending_review' THEN
    RAISE EXCEPTION '확정할 수 있는 예약 요청이 아닙니다.';
  END IF;

  SELECT *
  INTO v_link
  FROM public.public_booking_links
  WHERE id = v_request.link_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '예약 링크를 찾을 수 없습니다.';
  END IF;

  IF v_link.link_type <> 'consultation_booking' AND v_request.resource_id IS NULL THEN
    RAISE EXCEPTION '회의실 예약에는 회의실이 필요합니다.';
  END IF;

  IF v_link.link_type = 'consultation_booking'
    AND v_request.meeting_mode = 'visit'
    AND v_request.resource_id IS NULL THEN
    RAISE EXCEPTION '방문 상담 예약에는 회의실이 필요합니다.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      concat_ws(
        ':',
        'public_booking',
        COALESCE(v_request.resource_id::text, 'no-resource'),
        COALESCE(v_request.assigned_to::text, 'no-user'),
        v_request.starts_at::text,
        v_request.ends_at::text
      ),
      0
    )
  );

  IF v_request.resource_id IS NOT NULL THEN
    SELECT *
    INTO v_resource
    FROM public.calendar_resources
    WHERE id = v_request.resource_id
      AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION '예약 가능한 회의실을 찾을 수 없습니다.';
    END IF;

    SELECT public.get_calendar_resource_conflict(
      ARRAY[v_request.resource_id],
      v_request.starts_at,
      v_request.ends_at,
      NULL
    )
    INTO v_conflict;

    IF v_conflict IS NOT NULL THEN
      RAISE EXCEPTION '이미 예약된 회의실입니다: %', v_conflict;
    END IF;
  END IF;

  IF v_request.assigned_to IS NOT NULL THEN
    SELECT public.get_calendar_user_conflict(
      ARRAY[v_request.assigned_to],
      v_request.starts_at,
      v_request.ends_at,
      NULL
    )
    INTO v_user_conflict;

    IF v_user_conflict IS NOT NULL THEN
      RAISE EXCEPTION '이미 예약된 담당자입니다: %', v_user_conflict;
    END IF;
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
    ELSE '상담 예약'
  END;

  v_description := concat_ws(
    E'\n',
    NULLIF(v_request.purpose, ''),
    NULLIF(v_request.notes, ''),
    CASE WHEN v_request.phone IS NOT NULL THEN '연락처: ' || v_request.phone ELSE NULL END,
    CASE WHEN v_request.email IS NOT NULL THEN '이메일: ' || v_request.email ELSE NULL END
  );

  INSERT INTO public.calendar_events (
    title,
    description,
    starts_at,
    ends_at,
    all_day,
    location,
    visibility,
    status,
    created_by,
    source_type,
    source_id,
    source_subtype,
    source_path,
    accent,
    icon_type,
    created_by_name,
    client_name,
    client_contact,
    metadata
  )
  VALUES (
    v_title,
    NULLIF(v_description, ''),
    v_request.starts_at,
    v_request.ends_at,
    false,
    v_location,
    'title_only',
    'confirmed',
    COALESCE(_reviewer_id, v_request.assigned_to),
    'external_booking',
    v_request.id,
    v_link.link_type,
    '/meeting-reservations?tab=public',
    CASE WHEN v_link.link_type = 'consultation_booking' THEN '#14b8a6' ELSE '#38bdf8' END,
    CASE WHEN v_link.link_type = 'consultation_booking' THEN 'meeting' ELSE 'meeting_room' END,
    '외부 예약',
    COALESCE(v_request.company_name, v_request.requester_name),
    COALESCE(v_request.phone, v_request.email),
    jsonb_build_object(
      'publicBookingRequestId', v_request.id,
      'publicBookingLinkId', v_link.id,
      'publicBookingLinkSlug', v_link.slug,
      'publicBookingLinkType', v_link.link_type,
      'consultationLeadId', v_request.consultation_lead_id,
      'assignedTo', v_request.assigned_to,
      'meetingMode', v_request.meeting_mode,
      'requesterName', v_request.requester_name,
      'companyName', v_request.company_name,
      'clientContact', COALESCE(v_request.phone, v_request.email)
    )
  )
  RETURNING id INTO v_event_id;

  IF v_request.resource_id IS NOT NULL THEN
    INSERT INTO public.calendar_event_resources (event_id, resource_id)
    VALUES (v_event_id, v_request.resource_id);
  END IF;

  IF v_request.assigned_to IS NOT NULL THEN
    INSERT INTO public.calendar_event_participants (event_id, user_id, role, response_status)
    VALUES (v_event_id, v_request.assigned_to, 'assignee', 'accepted')
    ON CONFLICT (event_id, user_id, role) DO UPDATE SET
      role = EXCLUDED.role,
      response_status = EXCLUDED.response_status;
  END IF;

  v_review_note := COALESCE(NULLIF(_review_note, ''), '예약 확정');

  UPDATE public.public_booking_requests
  SET
    status = 'confirmed',
    calendar_event_id = v_event_id,
    reviewed_by = _reviewer_id,
    reviewed_at = now(),
    review_note = v_review_note,
    updated_at = now()
  WHERE id = v_request.id;

  IF v_request.consultation_lead_id IS NOT NULL THEN
    UPDATE public.client_consultation_leads
    SET
      public_booking_request_id = v_request.id,
      assigned_to = COALESCE(assigned_to, v_request.assigned_to),
      assigned_at = CASE WHEN assigned_to IS NULL AND v_request.assigned_to IS NOT NULL THEN now() ELSE assigned_at END,
      follow_up_at = v_request.starts_at,
      status = CASE WHEN status IN ('closed', 'converted') THEN status ELSE 'needs_review' END,
      memo = concat_ws(
        E'\n',
        NULLIF(memo, ''),
        '시스템: 상담 예약이 확정되었습니다. ' || to_char(v_request.starts_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI')
      ),
      updated_at = now()
    WHERE id = v_request.consultation_lead_id;
  END IF;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_public_booking_request(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_public_booking_request(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_public_booking_request(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_public_booking_request(uuid, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
