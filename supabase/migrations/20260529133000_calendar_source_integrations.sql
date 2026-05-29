-- Integrate legacy dashboard schedule sources into the internal calendar.

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS source_subtype text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS source_path text NULL,
  ADD COLUMN IF NOT EXISTS accent text NULL,
  ADD COLUMN IF NOT EXISTS icon_type text NULL;

ALTER TABLE public.calendar_events
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_source_type_check;

ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_source_type_check
  CHECK (
    source_type IN (
      'manual',
      'meeting_reservation',
      'peer_meeting',
      'announcement_event',
      'leave',
      'quote',
      'project',
      'holiday'
    )
  );

DROP INDEX IF EXISTS idx_calendar_events_source_unique;
CREATE UNIQUE INDEX idx_calendar_events_source_unique
  ON public.calendar_events(source_type, source_id, source_subtype)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_source_kind
  ON public.calendar_events(source_type, source_subtype, starts_at)
  WHERE status <> 'canceled';

DROP POLICY IF EXISTS "Calendar event creators can write own events" ON public.calendar_events;
CREATE POLICY "Calendar event creators can write own events"
ON public.calendar_events
FOR ALL
USING (
  auth.uid() = created_by
  AND source_type IN ('manual', 'meeting_reservation')
)
WITH CHECK (
  auth.uid() = created_by
  AND source_type IN ('manual', 'meeting_reservation')
);

CREATE OR REPLACE FUNCTION public.calendar_day_start_at(_date date)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ((_date::text || 'T00:00:00+09:00')::timestamptz)
$$;

CREATE OR REPLACE FUNCTION public.calendar_day_end_at(_date date)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT (((_date + 1)::text || 'T00:00:00+09:00')::timestamptz)
$$;

CREATE OR REPLACE FUNCTION public.calendar_try_date(_value text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN NULLIF(_value, '')::date;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.calendar_replace_event_participants(
  _event_id uuid,
  _organizer_id uuid DEFAULT NULL,
  _attendee_ids uuid[] DEFAULT '{}'::uuid[],
  _assignee_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.calendar_event_participants
  WHERE event_id = _event_id;

  IF _organizer_id IS NOT NULL THEN
    INSERT INTO public.calendar_event_participants (event_id, user_id, role, response_status, display_name)
    SELECT _event_id, _organizer_id, 'organizer', 'accepted', pd.full_name
    FROM public.profile_directory pd
    WHERE pd.id = _organizer_id
    UNION ALL
    SELECT _event_id, _organizer_id, 'organizer', 'accepted', '담당자'
    WHERE NOT EXISTS (SELECT 1 FROM public.profile_directory pd WHERE pd.id = _organizer_id)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.calendar_event_participants (event_id, user_id, role, response_status, display_name)
  SELECT DISTINCT _event_id, attendee_id, 'attendee', 'accepted', pd.full_name
  FROM unnest(COALESCE(_attendee_ids, '{}'::uuid[])) AS attendee_id
  LEFT JOIN public.profile_directory pd ON pd.id = attendee_id
  WHERE attendee_id IS NOT NULL
    AND attendee_id IS DISTINCT FROM _organizer_id
  ON CONFLICT DO NOTHING;

  INSERT INTO public.calendar_event_participants (event_id, user_id, role, response_status, display_name)
  SELECT DISTINCT _event_id, assignee_id, 'assignee', 'accepted', pd.full_name
  FROM unnest(COALESCE(_assignee_ids, '{}'::uuid[])) AS assignee_id
  LEFT JOIN public.profile_directory pd ON pd.id = assignee_id
  WHERE assignee_id IS NOT NULL
    AND assignee_id IS DISTINCT FROM _organizer_id
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.calendar_upsert_source_event(
  _source_type text,
  _source_id uuid,
  _source_subtype text,
  _title text,
  _description text,
  _starts_at timestamptz,
  _ends_at timestamptz,
  _all_day boolean,
  _location text,
  _visibility text,
  _status text,
  _created_by uuid,
  _created_by_name text,
  _team_department text,
  _recipient_id uuid,
  _client_name text,
  _client_contact text,
  _source_path text,
  _accent text,
  _icon_type text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  IF _source_id IS NULL OR _starts_at IS NULL OR _ends_at IS NULL OR _ends_at <= _starts_at THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.calendar_events (
    title,
    description,
    starts_at,
    ends_at,
    all_day,
    location,
    visibility,
    status,
    source_type,
    source_id,
    source_subtype,
    source_path,
    accent,
    icon_type,
    created_by,
    created_by_name,
    team_department,
    recipient_id,
    client_name,
    client_contact,
    metadata
  )
  VALUES (
    COALESCE(NULLIF(_title, ''), '일정'),
    NULLIF(_description, ''),
    _starts_at,
    _ends_at,
    COALESCE(_all_day, false),
    NULLIF(_location, ''),
    COALESCE(NULLIF(_visibility, ''), 'title_only'),
    COALESCE(NULLIF(_status, ''), 'scheduled'),
    _source_type,
    _source_id,
    COALESCE(NULLIF(_source_subtype, ''), 'default'),
    NULLIF(_source_path, ''),
    NULLIF(_accent, ''),
    NULLIF(_icon_type, ''),
    _created_by,
    COALESCE(NULLIF(_created_by_name, ''), '시스템'),
    NULLIF(_team_department, ''),
    _recipient_id,
    NULLIF(_client_name, ''),
    NULLIF(_client_contact, ''),
    COALESCE(_metadata, '{}'::jsonb)
  )
  ON CONFLICT (source_type, source_id, source_subtype) WHERE source_id IS NOT NULL
  DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    starts_at = EXCLUDED.starts_at,
    ends_at = EXCLUDED.ends_at,
    all_day = EXCLUDED.all_day,
    location = EXCLUDED.location,
    visibility = EXCLUDED.visibility,
    status = EXCLUDED.status,
    source_path = EXCLUDED.source_path,
    accent = EXCLUDED.accent,
    icon_type = EXCLUDED.icon_type,
    created_by = EXCLUDED.created_by,
    created_by_name = EXCLUDED.created_by_name,
    team_department = EXCLUDED.team_department,
    recipient_id = EXCLUDED.recipient_id,
    client_name = EXCLUDED.client_name,
    client_contact = EXCLUDED.client_contact,
    metadata = EXCLUDED.metadata,
    updated_at = now()
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.calendar_sync_saved_quote(_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q record;
  v_title text;
  v_issued_event_id uuid;
  v_delivery_event_id uuid;
  v_delivery_status text;
BEGIN
  SELECT sq.*, p.status AS linked_project_status
  INTO q
  FROM public.saved_quotes sq
  LEFT JOIN public.projects p ON p.id = sq.project_id
  WHERE sq.id = _quote_id;

  IF NOT FOUND THEN
    UPDATE public.calendar_events
    SET status = 'canceled', updated_at = now()
    WHERE source_type = 'quote'
      AND source_id = _quote_id;
    RETURN;
  END IF;

  v_title := COALESCE(NULLIF(q.project_name, ''), NULLIF(q.recipient_company, ''), '견적 ' || q.quote_number);

  IF q.quote_date IS NOT NULL THEN
    v_issued_event_id := public.calendar_upsert_source_event(
      'quote',
      q.id,
      'issued',
      '견적 발행 · ' || v_title,
      '견적번호 ' || q.quote_number,
      public.calendar_day_start_at((q.quote_date AT TIME ZONE 'Asia/Seoul')::date),
      public.calendar_day_end_at((q.quote_date AT TIME ZONE 'Asia/Seoul')::date),
      true,
      NULL,
      'title_only',
      'scheduled',
      q.user_id,
      COALESCE(NULLIF(q.issuer_name, ''), NULLIF(q.assigned_to_name, ''), '견적 담당자'),
      q.issuer_department,
      NULL,
      q.recipient_company,
      q.recipient_phone,
      '/saved-quotes/' || q.id::text,
      '#2563eb',
      'quote',
      jsonb_build_object(
        'quote_number', q.quote_number,
        'project_name', q.project_name,
        'recipient_company', q.recipient_company,
        'calendar_kind', 'quote_issued'
      )
    );

    PERFORM public.calendar_replace_event_participants(
      v_issued_event_id,
      q.user_id,
      '{}'::uuid[],
      CASE WHEN q.assigned_to IS NOT NULL THEN ARRAY[q.assigned_to]::uuid[] ELSE '{}'::uuid[] END
    );
  ELSE
    DELETE FROM public.calendar_events
    WHERE source_type = 'quote'
      AND source_id = q.id
      AND source_subtype = 'issued';
  END IF;

  IF q.desired_delivery_date IS NOT NULL THEN
    v_delivery_status := CASE
      WHEN q.project_stage = 'cancelled'
        OR q.quote_status = 'cancelled'
        OR q.linked_project_status = 'cancelled'
      THEN 'canceled'
      ELSE 'scheduled'
    END;

    v_delivery_event_id := public.calendar_upsert_source_event(
      'quote',
      q.id,
      'delivery',
      '납기 희망 · ' || v_title,
      '견적번호 ' || q.quote_number,
      public.calendar_day_start_at((q.desired_delivery_date AT TIME ZONE 'Asia/Seoul')::date),
      public.calendar_day_end_at((q.desired_delivery_date AT TIME ZONE 'Asia/Seoul')::date),
      true,
      q.recipient_address,
      'title_only',
      v_delivery_status,
      q.user_id,
      COALESCE(NULLIF(q.issuer_name, ''), NULLIF(q.assigned_to_name, ''), '견적 담당자'),
      q.issuer_department,
      NULL,
      q.recipient_company,
      q.recipient_phone,
      '/saved-quotes/' || q.id::text,
      '#f97316',
      'delivery',
      jsonb_build_object(
        'quote_number', q.quote_number,
        'project_name', q.project_name,
        'recipient_company', q.recipient_company,
        'calendar_kind', 'quote_delivery'
      )
    );

    PERFORM public.calendar_replace_event_participants(
      v_delivery_event_id,
      q.user_id,
      '{}'::uuid[],
      CASE WHEN q.assigned_to IS NOT NULL THEN ARRAY[q.assigned_to]::uuid[] ELSE '{}'::uuid[] END
    );
  ELSE
    DELETE FROM public.calendar_events
    WHERE source_type = 'quote'
      AND source_id = q.id
      AND source_subtype = 'delivery';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_saved_quote_calendar_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.calendar_events
    SET status = 'canceled', updated_at = now()
    WHERE source_type = 'quote'
      AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  PERFORM public.calendar_sync_saved_quote(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_saved_quote_calendar_events_trigger ON public.saved_quotes;
CREATE TRIGGER sync_saved_quote_calendar_events_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.saved_quotes
FOR EACH ROW
EXECUTE FUNCTION public.sync_saved_quote_calendar_events();

CREATE OR REPLACE FUNCTION public.calendar_sync_project(_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
  v_event_id uuid;
  v_assignee_ids uuid[];
BEGIN
  SELECT *
  INTO p
  FROM public.projects
  WHERE id = _project_id;

  IF NOT FOUND THEN
    UPDATE public.calendar_events
    SET status = 'canceled', updated_at = now()
    WHERE source_type = 'project'
      AND source_id = _project_id;
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT user_id), '{}'::uuid[])
  INTO v_assignee_ids
  FROM public.project_assignments
  WHERE project_id = p.id;

  v_event_id := public.calendar_upsert_source_event(
    'project',
    p.id,
    'created',
    '프로젝트 · ' || p.name,
    p.description,
    public.calendar_day_start_at((p.created_at AT TIME ZONE 'Asia/Seoul')::date),
    public.calendar_day_end_at((p.created_at AT TIME ZONE 'Asia/Seoul')::date),
    true,
    NULL,
    'title_only',
    CASE WHEN p.status = 'cancelled' THEN 'canceled' ELSE 'scheduled' END,
    p.user_id,
    '프로젝트 담당자',
    NULL,
    p.recipient_id,
    p.contact_name,
    p.contact_phone,
    '/project-management?id=' || p.id::text,
    '#059669',
    'project',
    jsonb_build_object(
      'project_name', p.name,
      'project_status', p.status,
      'project_type', p.project_type,
      'calendar_kind', 'project_created'
    )
  );

  PERFORM public.calendar_replace_event_participants(v_event_id, p.user_id, '{}'::uuid[], v_assignee_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_project_calendar_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.calendar_events
    SET status = 'canceled', updated_at = now()
    WHERE source_type = 'project'
      AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  PERFORM public.calendar_sync_project(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_project_calendar_event_trigger ON public.projects;
CREATE TRIGGER sync_project_calendar_event_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.sync_project_calendar_event();

CREATE OR REPLACE FUNCTION public.sync_project_assignment_calendar_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.calendar_sync_project(OLD.project_id);
    RETURN OLD;
  END IF;

  PERFORM public.calendar_sync_project(NEW.project_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_project_assignment_calendar_event_trigger ON public.project_assignments;
CREATE TRIGGER sync_project_assignment_calendar_event_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.project_assignments
FOR EACH ROW
EXECUTE FUNCTION public.sync_project_assignment_calendar_event();

CREATE OR REPLACE FUNCTION public.calendar_sync_leave_request(_leave_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lr record;
  v_event_id uuid;
BEGIN
  SELECT *
  INTO lr
  FROM public.leave_requests
  WHERE id = _leave_id;

  IF NOT FOUND OR lr.status <> 'approved' THEN
    DELETE FROM public.calendar_events
    WHERE source_type = 'leave'
      AND source_id = _leave_id;
    RETURN;
  END IF;

  v_event_id := public.calendar_upsert_source_event(
    'leave',
    lr.id,
    'approved',
    '휴가 · ' || lr.user_name,
    lr.reason,
    public.calendar_day_start_at(lr.start_date),
    public.calendar_day_end_at(lr.end_date),
    true,
    NULL,
    'title_only',
    'confirmed',
    lr.user_id,
    lr.user_name,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '#14b8a6',
    'leave',
    jsonb_build_object(
      'leave_type', lr.leave_type,
      'days', lr.days,
      'calendar_kind', 'approved_leave'
    )
  );

  PERFORM public.calendar_replace_event_participants(v_event_id, lr.user_id, '{}'::uuid[], '{}'::uuid[]);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_leave_request_calendar_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.calendar_events
    WHERE source_type = 'leave'
      AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  PERFORM public.calendar_sync_leave_request(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_leave_request_calendar_event_trigger ON public.leave_requests;
CREATE TRIGGER sync_leave_request_calendar_event_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_leave_request_calendar_event();

CREATE OR REPLACE FUNCTION public.calendar_sync_company_holiday(_holiday_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h record;
BEGIN
  SELECT *
  INTO h
  FROM public.company_holidays
  WHERE id = _holiday_id;

  IF NOT FOUND THEN
    DELETE FROM public.calendar_events
    WHERE source_type = 'holiday'
      AND source_id = _holiday_id;
    RETURN;
  END IF;

  PERFORM public.calendar_upsert_source_event(
    'holiday',
    h.id,
    COALESCE(NULLIF(h.holiday_type, ''), 'custom'),
    h.name,
    NULL,
    public.calendar_day_start_at(h.start_date),
    public.calendar_day_end_at(h.end_date),
    true,
    NULL,
    'details',
    'confirmed',
    NULL,
    '시스템',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '#ef4444',
    'holiday',
    jsonb_build_object(
      'holiday_type', h.holiday_type,
      'is_recurring', h.is_recurring,
      'substitute_holiday', h.substitute_holiday,
      'calendar_kind', 'company_holiday'
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_company_holiday_calendar_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.calendar_events
    WHERE source_type = 'holiday'
      AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  PERFORM public.calendar_sync_company_holiday(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_company_holiday_calendar_event_trigger ON public.company_holidays;
CREATE TRIGGER sync_company_holiday_calendar_event_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.company_holidays
FOR EACH ROW
EXECUTE FUNCTION public.sync_company_holiday_calendar_event();

CREATE OR REPLACE FUNCTION public.calendar_sync_peer_meeting(_feedback_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pf record;
  v_event_id uuid;
BEGIN
  SELECT
    f.*,
    COALESCE(sender.full_name, '보낸 사람') AS sender_name,
    COALESCE(receiver.full_name, '받는 사람') AS receiver_name
  INTO pf
  FROM public.peer_feedback f
  LEFT JOIN public.profile_directory sender ON sender.id = f.sender_id
  LEFT JOIN public.profile_directory receiver ON receiver.id = f.receiver_id
  WHERE f.id = _feedback_id;

  IF NOT FOUND
    OR pf.feedback_type <> 'meeting'
    OR pf.meeting_status NOT IN ('accepted', 'rescheduled')
    OR pf.meeting_date IS NULL
  THEN
    DELETE FROM public.calendar_events
    WHERE source_type = 'peer_meeting'
      AND source_id = _feedback_id;
    RETURN;
  END IF;

  v_event_id := public.calendar_upsert_source_event(
    'peer_meeting',
    pf.id,
    COALESCE(NULLIF(pf.meeting_status, ''), 'accepted'),
    '1:1 미팅 · ' || pf.sender_name || ' ↔ ' || pf.receiver_name,
    pf.message,
    public.calendar_meeting_start_at(pf.meeting_date, COALESCE(NULLIF(pf.meeting_time, ''), '10:00')),
    public.calendar_meeting_start_at(pf.meeting_date, COALESCE(NULLIF(pf.meeting_time, ''), '10:00')) + interval '1 hour',
    false,
    NULL,
    'title_only',
    CASE WHEN pf.meeting_status = 'accepted' THEN 'confirmed' ELSE 'scheduled' END,
    pf.sender_id,
    pf.sender_name,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '#b45309',
    'meeting',
    jsonb_build_object(
      'sender_name', pf.sender_name,
      'receiver_name', pf.receiver_name,
      'meeting_status', pf.meeting_status,
      'calendar_kind', 'peer_meeting'
    )
  );

  PERFORM public.calendar_replace_event_participants(v_event_id, pf.sender_id, ARRAY[pf.receiver_id]::uuid[], '{}'::uuid[]);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_peer_meeting_calendar_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.calendar_events
    WHERE source_type = 'peer_meeting'
      AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  PERFORM public.calendar_sync_peer_meeting(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_peer_meeting_calendar_event_trigger ON public.peer_feedback;
CREATE TRIGGER sync_peer_meeting_calendar_event_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.peer_feedback
FOR EACH ROW
EXECUTE FUNCTION public.sync_peer_meeting_calendar_event();

CREATE OR REPLACE FUNCTION public.calendar_sync_announcement_event(_announcement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a record;
  v_end_date date;
  v_event_id uuid;
BEGIN
  SELECT *
  INTO a
  FROM public.announcements
  WHERE id = _announcement_id;

  IF NOT FOUND
    OR a.announcement_type <> 'event'
    OR a.meeting_date IS NULL
    OR a.meeting_reservation_id IS NOT NULL
  THEN
    DELETE FROM public.calendar_events
    WHERE source_type = 'announcement_event'
      AND source_id = _announcement_id;
    RETURN;
  END IF;

  v_end_date := COALESCE(public.calendar_try_date(a.event_end_date), a.meeting_date);
  IF v_end_date < a.meeting_date THEN
    v_end_date := a.meeting_date;
  END IF;

  v_event_id := public.calendar_upsert_source_event(
    'announcement_event',
    a.id,
    'event',
    a.title,
    a.content,
    public.calendar_day_start_at(a.meeting_date),
    public.calendar_day_end_at(v_end_date),
    true,
    a.meeting_location,
    'details',
    'confirmed',
    a.author_id,
    a.author_name,
    NULL,
    NULL,
    NULL,
    NULL,
    '/meeting-reservations?event=' || a.id::text,
    '#10b981',
    'event',
    jsonb_build_object(
      'author_name', a.author_name,
      'calendar_kind', 'announcement_event'
    )
  );

  PERFORM public.calendar_replace_event_participants(v_event_id, a.author_id, '{}'::uuid[], '{}'::uuid[]);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_announcement_calendar_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.calendar_events
    WHERE source_type = 'announcement_event'
      AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  PERFORM public.calendar_sync_announcement_event(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_announcement_calendar_event_trigger ON public.announcements;
CREATE TRIGGER sync_announcement_calendar_event_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION public.sync_announcement_calendar_event();

CREATE OR REPLACE FUNCTION public.sync_meeting_reservation_calendar_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_resource_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.calendar_event_id IS NOT NULL THEN
      UPDATE public.calendar_events
      SET status = 'canceled', updated_at = now()
      WHERE id = OLD.calendar_event_id;
    END IF;
    RETURN OLD;
  END IF;

  v_starts_at := public.calendar_meeting_start_at(NEW.meeting_date, NEW.start_time);
  v_ends_at := CASE
    WHEN NEW.end_time IS NULL OR NEW.end_time = '' THEN v_starts_at + interval '1 hour'
    ELSE public.calendar_meeting_start_at(NEW.meeting_date, NEW.end_time)
  END;

  IF v_ends_at <= v_starts_at THEN
    v_ends_at := v_starts_at + interval '1 hour';
  END IF;

  INSERT INTO public.calendar_events (
    id,
    title,
    description,
    starts_at,
    ends_at,
    location,
    visibility,
    status,
    source_type,
    source_id,
    source_subtype,
    source_path,
    accent,
    icon_type,
    created_by,
    created_by_name,
    team_department,
    recipient_id,
    client_name,
    client_contact,
    metadata
  )
  VALUES (
    COALESCE(NEW.calendar_event_id, gen_random_uuid()),
    NEW.title,
    NEW.description,
    v_starts_at,
    v_ends_at,
    NEW.location,
    'title_only',
    NEW.status,
    'meeting_reservation',
    NEW.id,
    'default',
    '/meeting-reservations?id=' || NEW.id::text,
    '#0284c7',
    'meeting_reservation',
    NEW.created_by,
    NEW.created_by_name,
    NULL,
    NEW.recipient_id,
    NEW.client_name,
    NEW.client_contact,
    jsonb_build_object(
      'audience_type', NEW.audience_type,
      'employee_meeting_type', NEW.employee_meeting_type,
      'client_meeting_type', NEW.client_meeting_type
    )
  )
  ON CONFLICT (source_type, source_id, source_subtype) WHERE source_id IS NOT NULL
  DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    starts_at = EXCLUDED.starts_at,
    ends_at = EXCLUDED.ends_at,
    location = EXCLUDED.location,
    status = EXCLUDED.status,
    source_path = EXCLUDED.source_path,
    accent = EXCLUDED.accent,
    icon_type = EXCLUDED.icon_type,
    recipient_id = EXCLUDED.recipient_id,
    client_name = EXCLUDED.client_name,
    client_contact = EXCLUDED.client_contact,
    metadata = EXCLUDED.metadata,
    updated_at = now()
  RETURNING id INTO v_event_id;

  IF NEW.calendar_event_id IS DISTINCT FROM v_event_id THEN
    NEW.calendar_event_id := v_event_id;
  END IF;

  DELETE FROM public.calendar_event_participants
  WHERE event_id = v_event_id;

  INSERT INTO public.calendar_event_participants (event_id, user_id, role, response_status, display_name)
  VALUES (v_event_id, NEW.created_by, 'organizer', 'accepted', NEW.created_by_name)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.calendar_event_participants (event_id, user_id, role, response_status, display_name)
  SELECT v_event_id, participant_id, 'attendee', 'accepted', pd.full_name
  FROM unnest(COALESCE(NEW.participant_ids, '{}'::uuid[])) AS participant_id
  LEFT JOIN public.profile_directory pd ON pd.id = participant_id
  WHERE participant_id <> NEW.created_by
  ON CONFLICT DO NOTHING;

  DELETE FROM public.calendar_event_resources
  WHERE event_id = v_event_id;

  SELECT id
  INTO v_resource_id
  FROM public.calendar_resources
  WHERE is_active IS TRUE
    AND lower(name) = lower(COALESCE(NEW.location, ''))
  LIMIT 1;

  IF v_resource_id IS NOT NULL THEN
    INSERT INTO public.calendar_event_resources (event_id, resource_id)
    VALUES (v_event_id, v_resource_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.get_calendar_dashboard_summary(timestamptz, timestamptz, text);
DROP FUNCTION IF EXISTS public.get_calendar_events(timestamptz, timestamptz, jsonb);

CREATE OR REPLACE FUNCTION public.get_calendar_events(
  range_start timestamptz,
  range_end timestamptz,
  filters jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean,
  location text,
  visibility text,
  status text,
  source_type text,
  source_id uuid,
  source_subtype text,
  source_path text,
  accent text,
  icon_type text,
  created_by uuid,
  created_by_name text,
  team_department text,
  client_name text,
  client_contact text,
  participant_ids uuid[],
  participant_names text[],
  resource_ids uuid[],
  resource_names text[],
  can_edit boolean,
  is_redacted boolean,
  metadata jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ctx AS (
    SELECT
      auth.uid() AS user_id,
      COALESCE(filters->>'scope', 'my') AS scope,
      COALESCE((filters->>'includeCanceled')::boolean, false) AS include_canceled,
      public.has_role(auth.uid(), 'admin'::public.app_role) AS is_admin,
      public.has_role(auth.uid(), 'moderator'::public.app_role) AS is_moderator
  ),
  current_profile AS (
    SELECT p.id, p.department
    FROM public.profiles p
    JOIN ctx ON p.id = ctx.user_id
  ),
  decorated AS (
    SELECT
      e.*,
      ctx.user_id,
      ctx.scope,
      ctx.is_admin,
      ctx.is_moderator,
      (ctx.is_admin OR ctx.is_moderator) AS can_manage_all,
      (e.created_by = ctx.user_id) AS is_owner,
      EXISTS (
        SELECT 1
        FROM public.calendar_event_participants cep
        WHERE cep.event_id = e.id
          AND cep.user_id = ctx.user_id
      ) AS is_participant,
      (
        e.team_department IS NOT NULL
        AND e.team_department = (SELECT cp.department FROM current_profile cp)
      ) AS is_same_team,
      COALESCE(e.metadata->>'employee_meeting_type', '') = 'all_hands' AS is_all_hands,
      e.source_type IN ('holiday', 'announcement_event') AS is_public_source,
      EXISTS (
        SELECT 1
        FROM public.calendar_subscriptions cs
        WHERE cs.subscriber_id = ctx.user_id
          AND cs.is_visible IS TRUE
          AND cs.target_type = 'user'
          AND cs.target_user_id = e.created_by
      ) AS is_user_subscribed,
      EXISTS (
        SELECT 1
        FROM public.calendar_subscriptions cs
        WHERE cs.subscriber_id = ctx.user_id
          AND cs.is_visible IS TRUE
          AND cs.target_type = 'team'
          AND cs.target_department = e.team_department
      ) AS is_team_subscribed,
      EXISTS (
        SELECT 1
        FROM public.calendar_subscriptions cs
        JOIN public.calendar_event_resources cer ON cer.resource_id = cs.target_resource_id
        WHERE cs.subscriber_id = ctx.user_id
          AND cs.is_visible IS TRUE
          AND cs.target_type = 'resource'
          AND cer.event_id = e.id
      ) AS is_resource_subscribed
    FROM public.calendar_events e
    CROSS JOIN ctx
    WHERE e.starts_at < range_end
      AND e.ends_at > range_start
      AND (ctx.include_canceled OR e.status <> 'canceled')
  ),
  visible AS (
    SELECT
      d.*,
      (
        d.can_manage_all
        OR d.is_owner
        OR d.is_participant
        OR d.is_same_team
        OR d.is_public_source
      ) AS has_full_access,
      (
        d.scope = 'all'
        AND d.can_manage_all
      ) AS admin_all_scope
    FROM decorated d
    WHERE
      (
        d.scope = 'all'
        AND d.can_manage_all
      )
      OR d.is_owner
      OR d.is_participant
      OR d.is_all_hands
      OR d.is_public_source
      OR (d.is_same_team AND d.visibility <> 'private')
      OR d.is_user_subscribed
      OR d.is_team_subscribed
      OR d.is_resource_subscribed
      OR EXISTS (
        SELECT 1
        FROM public.calendar_event_resources cer
        WHERE cer.event_id = d.id
      )
  )
  SELECT
    v.id,
    CASE
      WHEN v.has_full_access OR v.visibility IN ('title_only', 'details') THEN v.title
      WHEN v.visibility = 'private' THEN '비공개 일정'
      ELSE '바쁨'
    END AS title,
    CASE
      WHEN v.has_full_access OR v.visibility = 'details' THEN v.description
      ELSE NULL
    END AS description,
    v.starts_at,
    v.ends_at,
    v.all_day,
    CASE
      WHEN v.has_full_access OR v.visibility IN ('title_only', 'details') THEN v.location
      ELSE NULL
    END AS location,
    v.visibility,
    v.status,
    v.source_type,
    v.source_id,
    v.source_subtype,
    CASE WHEN v.has_full_access THEN v.source_path ELSE NULL END AS source_path,
    v.accent,
    v.icon_type,
    v.created_by,
    v.created_by_name,
    v.team_department,
    CASE WHEN v.has_full_access OR v.visibility = 'details' THEN v.client_name ELSE NULL END AS client_name,
    CASE WHEN v.has_full_access OR v.visibility = 'details' THEN v.client_contact ELSE NULL END AS client_contact,
    COALESCE((
      SELECT array_agg(cep.user_id ORDER BY COALESCE(pd.full_name, cep.display_name, ''))
      FROM public.calendar_event_participants cep
      LEFT JOIN public.profile_directory pd ON pd.id = cep.user_id
      WHERE cep.event_id = v.id
    ), '{}'::uuid[]) AS participant_ids,
    COALESCE((
      SELECT array_agg(COALESCE(pd.full_name, cep.display_name, '구성원') ORDER BY COALESCE(pd.full_name, cep.display_name, ''))
      FROM public.calendar_event_participants cep
      LEFT JOIN public.profile_directory pd ON pd.id = cep.user_id
      WHERE cep.event_id = v.id
    ), '{}'::text[]) AS participant_names,
    COALESCE((
      SELECT array_agg(cer.resource_id ORDER BY cr.display_order, cr.name)
      FROM public.calendar_event_resources cer
      JOIN public.calendar_resources cr ON cr.id = cer.resource_id
      WHERE cer.event_id = v.id
    ), '{}'::uuid[]) AS resource_ids,
    COALESCE((
      SELECT array_agg(cr.name ORDER BY cr.display_order, cr.name)
      FROM public.calendar_event_resources cer
      JOIN public.calendar_resources cr ON cr.id = cer.resource_id
      WHERE cer.event_id = v.id
    ), '{}'::text[]) AS resource_names,
    (
      v.source_type IN ('manual', 'meeting_reservation')
      AND (v.can_manage_all OR v.is_owner)
    ) AS can_edit,
    NOT (v.has_full_access OR v.visibility = 'details') AS is_redacted,
    CASE WHEN v.has_full_access OR v.visibility = 'details' THEN v.metadata ELSE '{}'::jsonb END AS metadata
  FROM visible v
  ORDER BY v.starts_at ASC, v.title ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_calendar_dashboard_summary(
  range_start timestamptz,
  range_end timestamptz,
  scope text DEFAULT 'my'
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visible_events AS (
    SELECT *
    FROM public.get_calendar_events(range_start, range_end, jsonb_build_object('scope', scope))
  ),
  today_events AS (
    SELECT *
    FROM visible_events
    WHERE starts_at < public.calendar_day_end_at((now() AT TIME ZONE 'Asia/Seoul')::date)
      AND ends_at > public.calendar_day_start_at((now() AT TIME ZONE 'Asia/Seoul')::date)
  ),
  next_event AS (
    SELECT *
    FROM visible_events
    WHERE ends_at >= now()
    ORDER BY starts_at ASC
    LIMIT 1
  ),
  room_status AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', cr.id,
        'name', cr.name,
        'floor', cr.floor,
        'is_active', cr.is_active,
        'current_event', (
          SELECT jsonb_build_object(
            'id', e.id,
            'title', e.title,
            'starts_at', e.starts_at,
            'ends_at', e.ends_at
          )
          FROM public.calendar_event_resources cer
          JOIN public.get_calendar_events(now() - interval '1 day', now() + interval '7 day', jsonb_build_object('scope', scope)) e
            ON e.id = cer.event_id
          WHERE cer.resource_id = cr.id
            AND e.status <> 'canceled'
            AND e.starts_at <= now()
            AND e.ends_at > now()
          ORDER BY e.starts_at ASC
          LIMIT 1
        ),
        'next_event', (
          SELECT jsonb_build_object(
            'id', e.id,
            'title', e.title,
            'starts_at', e.starts_at,
            'ends_at', e.ends_at
          )
          FROM public.calendar_event_resources cer
          JOIN public.get_calendar_events(now(), now() + interval '14 day', jsonb_build_object('scope', scope)) e
            ON e.id = cer.event_id
          WHERE cer.resource_id = cr.id
            AND e.status <> 'canceled'
            AND e.starts_at >= now()
          ORDER BY e.starts_at ASC
          LIMIT 1
        )
      )
      ORDER BY cr.display_order, cr.name
    ) AS rooms
    FROM public.calendar_resources cr
    WHERE cr.is_active IS TRUE
  )
  SELECT jsonb_build_object(
    'today_count', (SELECT count(*) FROM today_events),
    'week_count', (SELECT count(*) FROM visible_events),
    'assigned_meeting_count', (
      SELECT count(*)
      FROM visible_events
      WHERE source_type IN ('manual', 'meeting_reservation', 'peer_meeting')
        AND starts_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
    ),
    'rooms_in_use_count', (
      SELECT count(*)
      FROM public.calendar_resources cr
      WHERE EXISTS (
        SELECT 1
        FROM public.calendar_event_resources cer
        JOIN public.calendar_events e ON e.id = cer.event_id
        WHERE cer.resource_id = cr.id
          AND e.status <> 'canceled'
          AND e.starts_at <= now()
          AND e.ends_at > now()
      )
    ),
    'next_event', (SELECT to_jsonb(next_event.*) FROM next_event),
    'rooms', COALESCE((SELECT rooms FROM room_status), '[]'::jsonb)
  );
$$;

UPDATE public.calendar_events
SET
  source_subtype = COALESCE(NULLIF(source_subtype, ''), 'default'),
  source_path = CASE
    WHEN source_type = 'meeting_reservation' AND source_id IS NOT NULL THEN '/meeting-reservations?id=' || source_id::text
    ELSE source_path
  END,
  accent = CASE
    WHEN source_type = 'meeting_reservation' THEN COALESCE(accent, '#0284c7')
    WHEN source_type = 'manual' THEN COALESCE(accent, '#111111')
    ELSE accent
  END,
  icon_type = CASE
    WHEN source_type = 'meeting_reservation' THEN COALESCE(icon_type, 'meeting_reservation')
    WHEN source_type = 'manual' THEN COALESCE(icon_type, 'calendar')
    ELSE icon_type
  END
WHERE source_type IN ('manual', 'meeting_reservation');

SELECT public.calendar_sync_saved_quote(id) FROM public.saved_quotes;
SELECT public.calendar_sync_project(id) FROM public.projects;
SELECT public.calendar_sync_leave_request(id) FROM public.leave_requests;
SELECT public.calendar_sync_company_holiday(id) FROM public.company_holidays;
SELECT public.calendar_sync_peer_meeting(id) FROM public.peer_feedback;
SELECT public.calendar_sync_announcement_event(id) FROM public.announcements;

GRANT EXECUTE ON FUNCTION public.get_calendar_events(timestamptz, timestamptz, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_calendar_dashboard_summary(timestamptz, timestamptz, text) TO authenticated;
