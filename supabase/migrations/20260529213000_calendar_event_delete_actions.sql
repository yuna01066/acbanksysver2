-- Harden editable calendar event mutations and add cancel/hard-delete RPC.

DROP POLICY IF EXISTS "Calendar event creators can write own events" ON public.calendar_events;
DROP POLICY IF EXISTS "Admins and moderators can manage calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar event creators can insert editable events" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar event creators can update own editable events" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar event creators can delete own editable events" ON public.calendar_events;
DROP POLICY IF EXISTS "Admins and moderators can insert editable calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Admins and moderators can update editable calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Admins and moderators can delete editable calendar events" ON public.calendar_events;

CREATE POLICY "Calendar event creators can insert editable events"
ON public.calendar_events
FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND source_type IN ('manual', 'meeting_reservation')
);

CREATE POLICY "Calendar event creators can update own editable events"
ON public.calendar_events
FOR UPDATE
USING (
  auth.uid() = created_by
  AND source_type IN ('manual', 'meeting_reservation')
)
WITH CHECK (
  auth.uid() = created_by
  AND source_type IN ('manual', 'meeting_reservation')
);

CREATE POLICY "Calendar event creators can delete own editable events"
ON public.calendar_events
FOR DELETE
USING (
  auth.uid() = created_by
  AND source_type IN ('manual', 'meeting_reservation')
);

CREATE POLICY "Admins and moderators can insert editable calendar events"
ON public.calendar_events
FOR INSERT
WITH CHECK (
  (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  )
  AND source_type IN ('manual', 'meeting_reservation')
);

CREATE POLICY "Admins and moderators can update editable calendar events"
ON public.calendar_events
FOR UPDATE
USING (
  (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  )
  AND source_type IN ('manual', 'meeting_reservation')
)
WITH CHECK (
  (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  )
  AND source_type IN ('manual', 'meeting_reservation')
);

CREATE POLICY "Admins and moderators can delete editable calendar events"
ON public.calendar_events
FOR DELETE
USING (
  (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  )
  AND source_type IN ('manual', 'meeting_reservation')
);

CREATE OR REPLACE FUNCTION public.update_calendar_event(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_event_id uuid := NULLIF(payload->>'id', '')::uuid;
  v_existing public.calendar_events%ROWTYPE;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_resource_ids uuid[];
  v_participant_ids uuid[];
  v_assignee_ids uuid[];
  v_conflict text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.calendar_events
  WHERE id = v_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '일정을 찾을 수 없습니다.';
  END IF;

  IF v_existing.source_type NOT IN ('manual', 'meeting_reservation') THEN
    RAISE EXCEPTION '원본 연동 일정은 캘린더에서 직접 수정할 수 없습니다.';
  END IF;

  IF v_existing.created_by <> v_user_id
    AND NOT public.has_role(v_user_id, 'admin'::public.app_role)
    AND NOT public.has_role(v_user_id, 'moderator'::public.app_role)
  THEN
    RAISE EXCEPTION '일정 수정 권한이 없습니다.';
  END IF;

  v_starts_at := COALESCE(NULLIF(payload->>'starts_at', '')::timestamptz, v_existing.starts_at);
  v_ends_at := COALESCE(NULLIF(payload->>'ends_at', '')::timestamptz, v_existing.ends_at);

  IF v_ends_at <= v_starts_at THEN
    RAISE EXCEPTION '일정 시작/종료 시간이 올바르지 않습니다.';
  END IF;

  IF payload ? 'resource_ids' THEN
    SELECT COALESCE(array_agg(value::uuid), '{}'::uuid[])
    INTO v_resource_ids
    FROM jsonb_array_elements_text(COALESCE(payload->'resource_ids', '[]'::jsonb)) AS value;
  ELSE
    SELECT COALESCE(array_agg(resource_id), '{}'::uuid[])
    INTO v_resource_ids
    FROM public.calendar_event_resources
    WHERE event_id = v_event_id;
  END IF;

  IF array_length(v_resource_ids, 1) IS NOT NULL THEN
    SELECT cr.name
    INTO v_conflict
    FROM public.calendar_event_resources cer
    JOIN public.calendar_events e ON e.id = cer.event_id
    JOIN public.calendar_resources cr ON cr.id = cer.resource_id
    WHERE cer.resource_id = ANY(v_resource_ids)
      AND cer.event_id <> v_event_id
      AND e.status <> 'canceled'
      AND tstzrange(e.starts_at, e.ends_at, '[)') && tstzrange(v_starts_at, v_ends_at, '[)')
    ORDER BY cr.display_order, cr.name
    LIMIT 1;

    IF v_conflict IS NOT NULL THEN
      RAISE EXCEPTION '이미 예약된 회의실입니다: %', v_conflict;
    END IF;
  END IF;

  UPDATE public.calendar_events
  SET
    title = COALESCE(NULLIF(payload->>'title', ''), title),
    description = CASE WHEN payload ? 'description' THEN NULLIF(payload->>'description', '') ELSE description END,
    starts_at = v_starts_at,
    ends_at = v_ends_at,
    all_day = COALESCE((payload->>'all_day')::boolean, all_day),
    location = CASE WHEN payload ? 'location' THEN NULLIF(payload->>'location', '') ELSE location END,
    visibility = COALESCE(NULLIF(payload->>'visibility', ''), visibility),
    status = COALESCE(NULLIF(payload->>'status', ''), status),
    team_department = CASE WHEN payload ? 'team_department' THEN NULLIF(payload->>'team_department', '') ELSE team_department END,
    recipient_id = CASE WHEN payload ? 'recipient_id' THEN NULLIF(payload->>'recipient_id', '')::uuid ELSE recipient_id END,
    client_name = CASE WHEN payload ? 'client_name' THEN NULLIF(payload->>'client_name', '') ELSE client_name END,
    client_contact = CASE WHEN payload ? 'client_contact' THEN NULLIF(payload->>'client_contact', '') ELSE client_contact END,
    metadata = COALESCE(payload->'metadata', metadata),
    updated_at = now()
  WHERE id = v_event_id;

  IF payload ? 'participant_ids' OR payload ? 'assignee_ids' THEN
    DELETE FROM public.calendar_event_participants
    WHERE event_id = v_event_id
      AND role IN ('attendee', 'assignee');

    SELECT COALESCE(array_agg(DISTINCT value::uuid), '{}'::uuid[])
    INTO v_participant_ids
    FROM jsonb_array_elements_text(COALESCE(payload->'participant_ids', '[]'::jsonb)) AS value
    WHERE value::uuid <> v_existing.created_by;

    INSERT INTO public.calendar_event_participants (event_id, user_id, role, response_status, display_name)
    SELECT v_event_id, participant_id, 'attendee', 'accepted', pd.full_name
    FROM unnest(v_participant_ids) AS participant_id
    LEFT JOIN public.profile_directory pd ON pd.id = participant_id
    ON CONFLICT DO NOTHING;

    SELECT COALESCE(array_agg(DISTINCT value::uuid), '{}'::uuid[])
    INTO v_assignee_ids
    FROM jsonb_array_elements_text(COALESCE(payload->'assignee_ids', '[]'::jsonb)) AS value
    WHERE value::uuid <> v_existing.created_by;

    INSERT INTO public.calendar_event_participants (event_id, user_id, role, response_status, display_name)
    SELECT v_event_id, assignee_id, 'assignee', 'accepted', pd.full_name
    FROM unnest(v_assignee_ids) AS assignee_id
    LEFT JOIN public.profile_directory pd ON pd.id = assignee_id
    ON CONFLICT DO NOTHING;
  END IF;

  IF payload ? 'resource_ids' THEN
    DELETE FROM public.calendar_event_resources
    WHERE event_id = v_event_id;

    INSERT INTO public.calendar_event_resources (event_id, resource_id)
    SELECT v_event_id, resource_id
    FROM unnest(v_resource_ids) AS resource_id
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, description, data)
  SELECT DISTINCT cep.user_id, 'calendar_event_updated', '일정이 변경되었습니다',
    COALESCE(NULLIF(payload->>'title', ''), v_existing.title) || ' / ' || to_char(v_starts_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI'),
    jsonb_build_object('calendarEventId', v_event_id)
  FROM public.calendar_event_participants cep
  WHERE cep.event_id = v_event_id
    AND cep.user_id <> v_user_id;

  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_calendar_event(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_event_id uuid := NULLIF(payload->>'id', '')::uuid;
  v_mode text := COALESCE(NULLIF(payload->>'mode', ''), 'cancel');
  v_existing public.calendar_events%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF v_mode NOT IN ('cancel', 'hard_delete') THEN
    RAISE EXCEPTION '지원하지 않는 일정 삭제 방식입니다.';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.calendar_events
  WHERE id = v_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '일정을 찾을 수 없습니다.';
  END IF;

  IF v_existing.source_type NOT IN ('manual', 'meeting_reservation') THEN
    RAISE EXCEPTION '원본 연동 일정은 캘린더에서 직접 삭제할 수 없습니다.';
  END IF;

  IF v_existing.created_by <> v_user_id
    AND NOT public.has_role(v_user_id, 'admin'::public.app_role)
    AND NOT public.has_role(v_user_id, 'moderator'::public.app_role)
  THEN
    RAISE EXCEPTION '일정 삭제 권한이 없습니다.';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, description, data)
  SELECT DISTINCT cep.user_id,
    CASE WHEN v_mode = 'cancel' THEN 'calendar_event_canceled' ELSE 'calendar_event_deleted' END,
    CASE WHEN v_mode = 'cancel' THEN '일정이 취소되었습니다' ELSE '일정이 삭제되었습니다' END,
    v_existing.title || ' / ' || to_char(v_existing.starts_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI'),
    jsonb_build_object('calendarEventId', v_event_id, 'mode', v_mode)
  FROM public.calendar_event_participants cep
  WHERE cep.event_id = v_event_id
    AND cep.user_id <> v_user_id;

  IF v_mode = 'cancel' THEN
    IF v_existing.source_type = 'meeting_reservation' AND v_existing.source_id IS NOT NULL THEN
      UPDATE public.meeting_reservations
      SET status = 'canceled', updated_at = now()
      WHERE id = v_existing.source_id;
    END IF;

    UPDATE public.calendar_events
    SET status = 'canceled', updated_at = now()
    WHERE id = v_event_id;

    RETURN v_event_id;
  END IF;

  IF v_existing.source_type = 'meeting_reservation' AND v_existing.source_id IS NOT NULL THEN
    DELETE FROM public.meeting_reservations
    WHERE id = v_existing.source_id;
  END IF;

  DELETE FROM public.calendar_event_resources
  WHERE event_id = v_event_id;

  DELETE FROM public.calendar_event_participants
  WHERE event_id = v_event_id;

  DELETE FROM public.calendar_events
  WHERE id = v_event_id;

  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_calendar_event(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_calendar_event(jsonb) TO authenticated;
