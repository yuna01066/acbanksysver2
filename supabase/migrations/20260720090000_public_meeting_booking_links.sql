-- Public customer and partner meeting-room booking links.

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
      'holiday',
      'birthday',
      'notion',
      'external_booking'
    )
  );

CREATE TABLE IF NOT EXISTS public.public_booking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  link_type text NOT NULL DEFAULT 'customer_request',
  title text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  allowed_resource_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  allowed_weekdays integer[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5],
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '18:00',
  slot_minutes integer NOT NULL DEFAULT 30,
  duration_minutes integer NOT NULL DEFAULT 60,
  buffer_minutes integer NOT NULL DEFAULT 0,
  min_notice_minutes integer NOT NULL DEFAULT 120,
  max_days_ahead integer NOT NULL DEFAULT 60,
  requires_approval boolean NOT NULL DEFAULT true,
  access_code_hash text,
  notify_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_booking_links_type_check CHECK (link_type IN ('customer_request', 'partner_room')),
  CONSTRAINT public_booking_links_slug_check CHECK (slug ~ '^[a-z0-9][a-z0-9-]{5,79}$'),
  CONSTRAINT public_booking_links_weekday_check CHECK (
    array_length(allowed_weekdays, 1) IS NOT NULL
    AND allowed_weekdays <@ ARRAY[0, 1, 2, 3, 4, 5, 6]
  ),
  CONSTRAINT public_booking_links_resource_check CHECK (array_length(allowed_resource_ids, 1) IS NOT NULL),
  CONSTRAINT public_booking_links_time_check CHECK (end_time > start_time),
  CONSTRAINT public_booking_links_slot_check CHECK (slot_minutes IN (15, 30, 60)),
  CONSTRAINT public_booking_links_duration_check CHECK (duration_minutes IN (30, 60, 90, 120, 180, 240)),
  CONSTRAINT public_booking_links_buffer_check CHECK (buffer_minutes >= 0 AND buffer_minutes <= 120),
  CONSTRAINT public_booking_links_notice_check CHECK (min_notice_minutes >= 0 AND max_days_ahead BETWEEN 1 AND 180)
);

CREATE TABLE IF NOT EXISTS public.public_booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.public_booking_links(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending_review',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  resource_id uuid NOT NULL REFERENCES public.calendar_resources(id) ON DELETE RESTRICT,
  requester_name text NOT NULL,
  company_name text,
  phone text,
  email text,
  purpose text NOT NULL,
  notes text,
  calendar_event_id uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  ip_hash text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_booking_requests_status_check CHECK (status IN ('pending_review', 'confirmed', 'rejected', 'canceled', 'expired')),
  CONSTRAINT public_booking_requests_time_check CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_public_booking_links_active
  ON public.public_booking_links(is_active, link_type);

CREATE INDEX IF NOT EXISTS idx_public_booking_requests_link_status
  ON public.public_booking_requests(link_id, status, starts_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_booking_requests_resource_time
  ON public.public_booking_requests(resource_id, starts_at, ends_at)
  WHERE status IN ('pending_review', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_public_booking_requests_calendar_event
  ON public.public_booking_requests(calendar_event_id)
  WHERE calendar_event_id IS NOT NULL;

ALTER TABLE public.public_booking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_booking_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and moderators can manage public booking links" ON public.public_booking_links;
CREATE POLICY "Admins and moderators can manage public booking links"
ON public.public_booking_links
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

DROP POLICY IF EXISTS "Admins and moderators can manage public booking requests" ON public.public_booking_requests;
CREATE POLICY "Admins and moderators can manage public booking requests"
ON public.public_booking_requests
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

DROP TRIGGER IF EXISTS update_public_booking_links_updated_at ON public.public_booking_links;
CREATE TRIGGER update_public_booking_links_updated_at
BEFORE UPDATE ON public.public_booking_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_public_booking_requests_updated_at ON public.public_booking_requests;
CREATE TRIGGER update_public_booking_requests_updated_at
BEFORE UPDATE ON public.public_booking_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_calendar_resource_conflict(
  _resource_ids uuid[],
  _starts_at timestamptz,
  _ends_at timestamptz,
  _exclude_event_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT cr.name
  FROM public.calendar_event_resources cer
  JOIN public.calendar_events e ON e.id = cer.event_id
  JOIN public.calendar_resources cr ON cr.id = cer.resource_id
  WHERE cer.resource_id = ANY(_resource_ids)
    AND (_exclude_event_id IS NULL OR cer.event_id <> _exclude_event_id)
    AND e.status <> 'canceled'
    AND tstzrange(e.starts_at, e.ends_at, '[)') && tstzrange(_starts_at, _ends_at, '[)')
  ORDER BY cr.display_order, cr.name
  LIMIT 1;
$$;

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
  v_event_id uuid;
  v_title text;
BEGIN
  SELECT * INTO v_request
  FROM public.public_booking_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '예약 요청을 찾을 수 없습니다.';
  END IF;

  IF v_request.calendar_event_id IS NOT NULL THEN
    RETURN v_request.calendar_event_id;
  END IF;

  IF v_request.status NOT IN ('pending_review', 'confirmed') THEN
    RAISE EXCEPTION '확정할 수 없는 예약 상태입니다.';
  END IF;

  SELECT * INTO v_link
  FROM public.public_booking_links
  WHERE id = v_request.link_id;

  IF NOT FOUND OR v_link.is_active IS NOT TRUE THEN
    RAISE EXCEPTION '예약 링크가 비활성화되어 있습니다.';
  END IF;

  SELECT * INTO v_resource
  FROM public.calendar_resources
  WHERE id = v_request.resource_id
    AND is_active IS TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '회의실을 찾을 수 없습니다.';
  END IF;

  SELECT public.get_calendar_resource_conflict(
    ARRAY[v_request.resource_id],
    v_request.starts_at,
    v_request.ends_at,
    NULL
  ) INTO v_conflict;

  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION '이미 예약된 회의실입니다: %', v_conflict;
  END IF;

  v_title := CASE
    WHEN v_link.link_type = 'partner_room'
      THEN '공유회사 회의실 예약 · ' || COALESCE(NULLIF(v_request.company_name, ''), v_request.requester_name)
    ELSE '고객 미팅 · ' || COALESCE(NULLIF(v_request.company_name, ''), v_request.requester_name)
  END;

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
    accent,
    icon_type,
    created_by,
    created_by_name,
    client_name,
    client_contact,
    metadata
  )
  VALUES (
    v_title,
    concat_ws(E'\n', NULLIF(v_request.purpose, ''), NULLIF(v_request.notes, '')),
    v_request.starts_at,
    v_request.ends_at,
    false,
    v_resource.name,
    'title_only',
    'confirmed',
    'external_booking',
    v_request.id,
    v_link.link_type,
    '#38bdf8',
    'room',
    _reviewer_id,
    '외부 예약',
    COALESCE(NULLIF(v_request.company_name, ''), v_request.requester_name),
    NULL,
    jsonb_build_object(
      'public_booking_request_id', v_request.id,
      'public_booking_link_id', v_link.id,
      'public_booking_link_slug', v_link.slug,
      'public_booking_type', v_link.link_type,
      'requester_name', v_request.requester_name,
      'company_name', v_request.company_name,
      'resource_name', v_resource.name
    )
  )
  RETURNING id INTO v_event_id;

  INSERT INTO public.calendar_event_resources (event_id, resource_id)
  VALUES (v_event_id, v_request.resource_id)
  ON CONFLICT DO NOTHING;

  UPDATE public.public_booking_requests
  SET
    status = 'confirmed',
    calendar_event_id = v_event_id,
    reviewed_by = COALESCE(_reviewer_id, reviewed_by),
    reviewed_at = COALESCE(reviewed_at, now()),
    review_note = COALESCE(NULLIF(_review_note, ''), review_note),
    updated_at = now()
  WHERE id = v_request.id;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_public_booking_request(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_public_booking_request(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_public_booking_request(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_public_booking_request(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.get_calendar_resource_conflict(uuid[], timestamptz, timestamptz, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_calendar_resource_conflict(uuid[], timestamptz, timestamptz, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_calendar_resource_conflict(uuid[], timestamptz, timestamptz, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_calendar_resource_conflict(uuid[], timestamptz, timestamptz, uuid) TO service_role;

COMMENT ON TABLE public.public_booking_links IS 'Admin-managed public booking links for customer meeting requests and partner meeting-room reservations.';
COMMENT ON TABLE public.public_booking_requests IS 'Public booking request ledger. Public users submit through Edge Function only.';
COMMENT ON FUNCTION public.get_calendar_resource_conflict(uuid[], timestamptz, timestamptz, uuid) IS 'Service-side room conflict checker for public and internal booking flows.';
COMMENT ON FUNCTION public.confirm_public_booking_request(uuid, uuid, text) IS 'Service-role helper that atomically confirms a public booking request and creates the room calendar event.';

NOTIFY pgrst, 'reload schema';
