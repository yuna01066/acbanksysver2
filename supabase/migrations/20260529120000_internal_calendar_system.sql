-- Internal calendar, subscriptions, and meeting-room resources.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.meeting_reservations
  ADD COLUMN IF NOT EXISTS calendar_event_id uuid NULL;

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  location text NULL,
  visibility text NOT NULL DEFAULT 'title_only'
    CHECK (visibility IN ('private', 'busy_only', 'title_only', 'details')),
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'confirmed', 'completed', 'canceled')),
  source_type text NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'meeting_reservation', 'leave', 'quote', 'project', 'holiday')),
  source_id uuid NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_name text NOT NULL DEFAULT '담당자',
  team_department text NULL,
  recipient_id uuid NULL REFERENCES public.recipients(id) ON DELETE SET NULL,
  client_name text NULL,
  client_contact text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_events_time_order CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.calendar_event_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'attendee'
    CHECK (role IN ('organizer', 'attendee', 'assignee')),
  response_status text NOT NULL DEFAULT 'accepted'
    CHECK (response_status IN ('accepted', 'declined', 'tentative')),
  display_name text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id, role)
);

CREATE TABLE IF NOT EXISTS public.calendar_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  resource_type text NOT NULL DEFAULT 'meeting_room'
    CHECK (resource_type IN ('meeting_room')),
  floor text NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calendar_event_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.calendar_resources(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, resource_id)
);

CREATE TABLE IF NOT EXISTS public.calendar_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('user', 'team', 'resource')),
  target_user_id uuid NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_department text NULL,
  target_resource_id uuid NULL REFERENCES public.calendar_resources(id) ON DELETE CASCADE,
  display_name text NULL,
  color text NULL,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_subscriptions_single_target CHECK (
    (
      target_type = 'user'
      AND target_user_id IS NOT NULL
      AND target_department IS NULL
      AND target_resource_id IS NULL
    )
    OR (
      target_type = 'team'
      AND target_user_id IS NULL
      AND target_department IS NOT NULL
      AND target_resource_id IS NULL
    )
    OR (
      target_type = 'resource'
      AND target_user_id IS NULL
      AND target_department IS NULL
      AND target_resource_id IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_source_unique
  ON public.calendar_events(source_type, source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_range
  ON public.calendar_events(starts_at, ends_at)
  WHERE status <> 'canceled';

CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by
  ON public.calendar_events(created_by, starts_at);

CREATE INDEX IF NOT EXISTS idx_calendar_events_team
  ON public.calendar_events(team_department, starts_at)
  WHERE team_department IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_event_participants_user
  ON public.calendar_event_participants(user_id, event_id);

CREATE INDEX IF NOT EXISTS idx_calendar_event_resources_resource
  ON public.calendar_event_resources(resource_id, event_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_subscriptions_user_target
  ON public.calendar_subscriptions(
    subscriber_id,
    target_type,
    COALESCE(target_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(target_department, ''),
    COALESCE(target_resource_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

INSERT INTO public.calendar_resources (name, resource_type, floor, description, display_order)
VALUES
  ('1층 회의실', 'meeting_room', '1층', '1층 내부 회의실', 10),
  ('2층 회의실', 'meeting_room', '2층', '2층 내부 회의실', 20)
ON CONFLICT (name) DO UPDATE
SET
  resource_type = EXCLUDED.resource_type,
  floor = EXCLUDED.floor,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = true,
  updated_at = now();

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_event_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Calendar events are read through RPC" ON public.calendar_events;
CREATE POLICY "Calendar events are read through RPC"
ON public.calendar_events
FOR SELECT
USING (
  auth.uid() = created_by
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.calendar_event_participants cep
    WHERE cep.event_id = calendar_events.id
      AND cep.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Calendar event creators can write own events" ON public.calendar_events;
CREATE POLICY "Calendar event creators can write own events"
ON public.calendar_events
FOR ALL
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Admins and moderators can manage calendar events" ON public.calendar_events;
CREATE POLICY "Admins and moderators can manage calendar events"
ON public.calendar_events
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

DROP POLICY IF EXISTS "Users can read own calendar participants" ON public.calendar_event_participants;
CREATE POLICY "Users can read own calendar participants"
ON public.calendar_event_participants
FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.calendar_events e
    WHERE e.id = calendar_event_participants.event_id
      AND e.created_by = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

DROP POLICY IF EXISTS "Event owners can manage calendar participants" ON public.calendar_event_participants;
CREATE POLICY "Event owners can manage calendar participants"
ON public.calendar_event_participants
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.calendar_events e
    WHERE e.id = calendar_event_participants.event_id
      AND e.created_by = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.calendar_events e
    WHERE e.id = calendar_event_participants.event_id
      AND e.created_by = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

DROP POLICY IF EXISTS "Authenticated users can read calendar resources" ON public.calendar_resources;
CREATE POLICY "Authenticated users can read calendar resources"
ON public.calendar_resources
FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins and moderators can manage calendar resources" ON public.calendar_resources;
CREATE POLICY "Admins and moderators can manage calendar resources"
ON public.calendar_resources
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

DROP POLICY IF EXISTS "Users can read own calendar resource links" ON public.calendar_event_resources;
CREATE POLICY "Users can read own calendar resource links"
ON public.calendar_event_resources
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.calendar_events e
    WHERE e.id = calendar_event_resources.event_id
      AND (
        e.created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'moderator'::public.app_role)
        OR EXISTS (
          SELECT 1
          FROM public.calendar_event_participants cep
          WHERE cep.event_id = e.id
            AND cep.user_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "Event owners can manage calendar resource links" ON public.calendar_event_resources;
CREATE POLICY "Event owners can manage calendar resource links"
ON public.calendar_event_resources
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.calendar_events e
    WHERE e.id = calendar_event_resources.event_id
      AND e.created_by = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.calendar_events e
    WHERE e.id = calendar_event_resources.event_id
      AND e.created_by = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

DROP POLICY IF EXISTS "Users can manage own calendar subscriptions" ON public.calendar_subscriptions;
CREATE POLICY "Users can manage own calendar subscriptions"
ON public.calendar_subscriptions
FOR ALL
USING (subscriber_id = auth.uid())
WITH CHECK (subscriber_id = auth.uid());

DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON public.calendar_events;
CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_calendar_resources_updated_at ON public.calendar_resources;
CREATE TRIGGER update_calendar_resources_updated_at
BEFORE UPDATE ON public.calendar_resources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_calendar_subscriptions_updated_at ON public.calendar_subscriptions;
CREATE TRIGGER update_calendar_subscriptions_updated_at
BEFORE UPDATE ON public.calendar_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.calendar_meeting_start_at(_date date, _time text)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ((_date::text || 'T' || COALESCE(NULLIF(_time, ''), '10:00') || ':00+09:00')::timestamptz)
$$;

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
    (v.can_manage_all OR v.is_owner) AS can_edit,
    NOT (v.has_full_access OR v.visibility = 'details') AS is_redacted,
    CASE WHEN v.has_full_access OR v.visibility = 'details' THEN v.metadata ELSE '{}'::jsonb END AS metadata
  FROM visible v
  ORDER BY v.starts_at ASC, v.title ASC;
$$;

CREATE OR REPLACE FUNCTION public.create_calendar_event(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_name text;
  v_event_id uuid;
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

  v_starts_at := NULLIF(payload->>'starts_at', '')::timestamptz;
  v_ends_at := NULLIF(payload->>'ends_at', '')::timestamptz;

  IF v_starts_at IS NULL OR v_ends_at IS NULL OR v_ends_at <= v_starts_at THEN
    RAISE EXCEPTION '일정 시작/종료 시간이 올바르지 않습니다.';
  END IF;

  SELECT COALESCE(p.full_name, auth_user.email, '담당자')
  INTO v_user_name
  FROM auth.users auth_user
  LEFT JOIN public.profiles p ON p.id = auth_user.id
  WHERE auth_user.id = v_user_id;

  SELECT COALESCE(array_agg(value::uuid), '{}'::uuid[])
  INTO v_resource_ids
  FROM jsonb_array_elements_text(COALESCE(payload->'resource_ids', '[]'::jsonb)) AS value;

  IF array_length(v_resource_ids, 1) IS NOT NULL THEN
    SELECT cr.name
    INTO v_conflict
    FROM public.calendar_event_resources cer
    JOIN public.calendar_events e ON e.id = cer.event_id
    JOIN public.calendar_resources cr ON cr.id = cer.resource_id
    WHERE cer.resource_id = ANY(v_resource_ids)
      AND e.status <> 'canceled'
      AND tstzrange(e.starts_at, e.ends_at, '[)') && tstzrange(v_starts_at, v_ends_at, '[)')
    ORDER BY cr.display_order, cr.name
    LIMIT 1;

    IF v_conflict IS NOT NULL THEN
      RAISE EXCEPTION '이미 예약된 회의실입니다: %', v_conflict;
    END IF;
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
    created_by,
    created_by_name,
    team_department,
    recipient_id,
    client_name,
    client_contact,
    metadata
  )
  VALUES (
    NULLIF(payload->>'title', ''),
    NULLIF(payload->>'description', ''),
    v_starts_at,
    v_ends_at,
    COALESCE((payload->>'all_day')::boolean, false),
    NULLIF(payload->>'location', ''),
    COALESCE(NULLIF(payload->>'visibility', ''), 'title_only'),
    COALESCE(NULLIF(payload->>'status', ''), 'scheduled'),
    COALESCE(NULLIF(payload->>'source_type', ''), 'manual'),
    NULLIF(payload->>'source_id', '')::uuid,
    v_user_id,
    COALESCE(NULLIF(payload->>'created_by_name', ''), v_user_name),
    NULLIF(payload->>'team_department', ''),
    NULLIF(payload->>'recipient_id', '')::uuid,
    NULLIF(payload->>'client_name', ''),
    NULLIF(payload->>'client_contact', ''),
    COALESCE(payload->'metadata', '{}'::jsonb)
  )
  RETURNING id INTO v_event_id;

  INSERT INTO public.calendar_event_participants (event_id, user_id, role, response_status, display_name)
  VALUES (v_event_id, v_user_id, 'organizer', 'accepted', v_user_name)
  ON CONFLICT DO NOTHING;

  SELECT COALESCE(array_agg(DISTINCT value::uuid), '{}'::uuid[])
  INTO v_participant_ids
  FROM jsonb_array_elements_text(COALESCE(payload->'participant_ids', '[]'::jsonb)) AS value
  WHERE value::uuid <> v_user_id;

  INSERT INTO public.calendar_event_participants (event_id, user_id, role, response_status, display_name)
  SELECT v_event_id, participant_id, 'attendee', 'accepted', pd.full_name
  FROM unnest(v_participant_ids) AS participant_id
  LEFT JOIN public.profile_directory pd ON pd.id = participant_id
  ON CONFLICT DO NOTHING;

  SELECT COALESCE(array_agg(DISTINCT value::uuid), '{}'::uuid[])
  INTO v_assignee_ids
  FROM jsonb_array_elements_text(COALESCE(payload->'assignee_ids', '[]'::jsonb)) AS value
  WHERE value::uuid <> v_user_id;

  INSERT INTO public.calendar_event_participants (event_id, user_id, role, response_status, display_name)
  SELECT v_event_id, assignee_id, 'assignee', 'accepted', pd.full_name
  FROM unnest(v_assignee_ids) AS assignee_id
  LEFT JOIN public.profile_directory pd ON pd.id = assignee_id
  ON CONFLICT DO NOTHING;

  INSERT INTO public.calendar_event_resources (event_id, resource_id)
  SELECT v_event_id, resource_id
  FROM unnest(v_resource_ids) AS resource_id
  ON CONFLICT DO NOTHING;

  INSERT INTO public.notifications (user_id, type, title, description, data)
  SELECT target_id, 'calendar_event_created', '새 일정이 등록되었습니다',
    COALESCE(NULLIF(payload->>'title', ''), '일정') || ' / ' || to_char(v_starts_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI'),
    jsonb_build_object('calendarEventId', v_event_id)
  FROM (
    SELECT DISTINCT target_id
    FROM (
      SELECT unnest(v_participant_ids) AS target_id
      UNION ALL
      SELECT unnest(v_assignee_ids) AS target_id
    ) targets
    WHERE target_id <> v_user_id
  ) notify_targets;

  RETURN v_event_id;
END;
$$;

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
    WHERE (starts_at AT TIME ZONE 'Asia/Seoul')::date = (now() AT TIME ZONE 'Asia/Seoul')::date
  ),
  next_event AS (
    SELECT *
    FROM visible_events
    WHERE starts_at >= now()
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
      WHERE source_type IN ('manual', 'meeting_reservation')
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
  ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
  DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    starts_at = EXCLUDED.starts_at,
    ends_at = EXCLUDED.ends_at,
    location = EXCLUDED.location,
    status = EXCLUDED.status,
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

DROP TRIGGER IF EXISTS sync_meeting_reservation_calendar_event_trigger ON public.meeting_reservations;
CREATE TRIGGER sync_meeting_reservation_calendar_event_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.meeting_reservations
FOR EACH ROW
EXECUTE FUNCTION public.sync_meeting_reservation_calendar_event();

WITH inserted_events AS (
  INSERT INTO public.calendar_events (
    title,
    description,
    starts_at,
    ends_at,
    location,
    visibility,
    status,
    source_type,
    source_id,
    created_by,
    created_by_name,
    recipient_id,
    client_name,
    client_contact,
    metadata
  )
  SELECT
    mr.title,
    mr.description,
    public.calendar_meeting_start_at(mr.meeting_date, mr.start_time),
    CASE
      WHEN mr.end_time IS NULL OR mr.end_time = '' THEN public.calendar_meeting_start_at(mr.meeting_date, mr.start_time) + interval '1 hour'
      WHEN public.calendar_meeting_start_at(mr.meeting_date, mr.end_time) <= public.calendar_meeting_start_at(mr.meeting_date, mr.start_time)
        THEN public.calendar_meeting_start_at(mr.meeting_date, mr.start_time) + interval '1 hour'
      ELSE public.calendar_meeting_start_at(mr.meeting_date, mr.end_time)
    END,
    mr.location,
    'title_only',
    mr.status,
    'meeting_reservation',
    mr.id,
    mr.created_by,
    mr.created_by_name,
    mr.recipient_id,
    mr.client_name,
    mr.client_contact,
    jsonb_build_object(
      'audience_type', mr.audience_type,
      'employee_meeting_type', mr.employee_meeting_type,
      'client_meeting_type', mr.client_meeting_type
    )
  FROM public.meeting_reservations mr
  WHERE mr.calendar_event_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.calendar_events e
      WHERE e.source_type = 'meeting_reservation'
        AND e.source_id = mr.id
    )
  ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING
  RETURNING id, source_id
)
UPDATE public.meeting_reservations mr
SET calendar_event_id = ie.id
FROM inserted_events ie
WHERE mr.id = ie.source_id;

UPDATE public.meeting_reservations mr
SET calendar_event_id = e.id
FROM public.calendar_events e
WHERE mr.calendar_event_id IS NULL
  AND e.source_type = 'meeting_reservation'
  AND e.source_id = mr.id;

INSERT INTO public.calendar_event_participants (event_id, user_id, role, response_status, display_name)
SELECT DISTINCT mr.calendar_event_id, mr.created_by, 'organizer', 'accepted', mr.created_by_name
FROM public.meeting_reservations mr
WHERE mr.calendar_event_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.calendar_event_participants (event_id, user_id, role, response_status, display_name)
SELECT DISTINCT mr.calendar_event_id, participant_id, 'attendee', 'accepted', pd.full_name
FROM public.meeting_reservations mr
CROSS JOIN LATERAL unnest(COALESCE(mr.participant_ids, '{}'::uuid[])) AS participant_id
LEFT JOIN public.profile_directory pd ON pd.id = participant_id
WHERE mr.calendar_event_id IS NOT NULL
  AND participant_id <> mr.created_by
ON CONFLICT DO NOTHING;

INSERT INTO public.calendar_event_resources (event_id, resource_id)
SELECT DISTINCT mr.calendar_event_id, cr.id
FROM public.meeting_reservations mr
JOIN public.calendar_resources cr ON lower(cr.name) = lower(COALESCE(mr.location, ''))
WHERE mr.calendar_event_id IS NOT NULL
ON CONFLICT DO NOTHING;

GRANT SELECT ON public.calendar_resources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_subscriptions TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_calendar_events(timestamptz, timestamptz, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_calendar_event(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_calendar_event(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_calendar_dashboard_summary(timestamptz, timestamptz, text) TO authenticated;

INSERT INTO public.page_role_access (page_key, min_role)
VALUES ('/calendar', 'employee')
ON CONFLICT (page_key) DO UPDATE
SET min_role = EXCLUDED.min_role,
    updated_at = now();
