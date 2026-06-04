-- Expand the internal calendar into a private-first personal diary with tasks,
-- reminders, basic recurrence metadata, and safer private-event redaction.

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS recurrence_rule jsonb,
  ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS recurrence_exception_date date;

CREATE INDEX IF NOT EXISTS idx_calendar_events_recurrence
  ON public.calendar_events(starts_at, (recurrence_rule IS NOT NULL))
  WHERE recurrence_rule IS NOT NULL AND status <> 'canceled';

ALTER TABLE public.calendar_subscriptions
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_calendar_subscriptions_order
  ON public.calendar_subscriptions(subscriber_id, display_order, created_at);

CREATE TABLE IF NOT EXISTS public.calendar_event_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_minutes integer NOT NULL CHECK (reminder_minutes > 0),
  is_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id, reminder_minutes)
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_reminders_user_due
  ON public.calendar_event_reminders(user_id, reminder_minutes, is_sent);

CREATE TABLE IF NOT EXISTS public.calendar_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  task_date date NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'archived')),
  linked_event_id uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_tasks_owner_date
  ON public.calendar_tasks(owner_id, task_date, status);

ALTER TABLE public.calendar_event_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own calendar reminders" ON public.calendar_event_reminders;
CREATE POLICY "Users can manage own calendar reminders"
ON public.calendar_event_reminders
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own calendar tasks" ON public.calendar_tasks;
CREATE POLICY "Users can manage own calendar tasks"
ON public.calendar_tasks
FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP TRIGGER IF EXISTS update_calendar_event_reminders_updated_at ON public.calendar_event_reminders;
CREATE TRIGGER update_calendar_event_reminders_updated_at
BEFORE UPDATE ON public.calendar_event_reminders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_calendar_tasks_updated_at ON public.calendar_tasks;
CREATE TRIGGER update_calendar_tasks_updated_at
BEFORE UPDATE ON public.calendar_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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
  metadata jsonb,
  recurrence_rule jsonb,
  recurrence_parent_id uuid,
  recurrence_exception_date date,
  reminder_minutes integer[]
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
      (
        e.visibility = 'private'
        AND e.source_type = 'manual'
        AND e.team_department IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.calendar_event_resources cer WHERE cer.event_id = e.id)
        AND NOT EXISTS (
          SELECT 1
          FROM public.calendar_event_participants cep
          WHERE cep.event_id = e.id
            AND cep.role IS DISTINCT FROM 'organizer'
        )
      ) AS is_private_personal,
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
    WHERE (
        (
          e.starts_at < range_end
          AND e.ends_at > range_start
        )
        OR (
          e.recurrence_rule IS NOT NULL
          AND e.starts_at < range_end
          AND (
            NULLIF(e.recurrence_rule->>'until', '') IS NULL
            OR (NULLIF(e.recurrence_rule->>'until', '')::timestamptz + interval '1 day') > range_start
          )
        )
      )
      AND (ctx.include_canceled OR e.status <> 'canceled')
  ),
  visible AS (
    SELECT
      d.*,
      (
        d.is_owner
        OR d.is_participant
        OR d.is_same_team
        OR d.is_public_source
        OR (
          d.can_manage_all
          AND NOT (d.is_private_personal AND NOT d.is_owner)
        )
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
        AND cep.role IS DISTINCT FROM 'organizer'
    ), '{}'::uuid[]) AS participant_ids,
    COALESCE((
      SELECT array_agg(COALESCE(pd.full_name, cep.display_name, '구성원') ORDER BY COALESCE(pd.full_name, cep.display_name, ''))
      FROM public.calendar_event_participants cep
      LEFT JOIN public.profile_directory pd ON pd.id = cep.user_id
      WHERE cep.event_id = v.id
        AND cep.role IS DISTINCT FROM 'organizer'
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
      AND (v.is_owner OR (v.can_manage_all AND NOT (v.is_private_personal AND NOT v.is_owner)))
    ) AS can_edit,
    NOT (v.has_full_access OR v.visibility = 'details') AS is_redacted,
    CASE WHEN v.has_full_access OR v.visibility = 'details' THEN v.metadata ELSE '{}'::jsonb END AS metadata,
    CASE WHEN v.has_full_access OR v.visibility = 'details' THEN v.recurrence_rule ELSE NULL END AS recurrence_rule,
    v.recurrence_parent_id,
    v.recurrence_exception_date,
    CASE
      WHEN v.is_owner THEN COALESCE((
        SELECT array_agg(cer.reminder_minutes ORDER BY cer.reminder_minutes)
        FROM public.calendar_event_reminders cer
        WHERE cer.event_id = v.id
          AND cer.user_id = v.user_id
      ), '{}'::integer[])
      ELSE '{}'::integer[]
    END AS reminder_minutes
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
    metadata,
    recurrence_rule
  )
  VALUES (
    NULLIF(payload->>'title', ''),
    NULLIF(payload->>'description', ''),
    v_starts_at,
    v_ends_at,
    COALESCE((payload->>'all_day')::boolean, false),
    NULLIF(payload->>'location', ''),
    COALESCE(NULLIF(payload->>'visibility', ''), 'private'),
    COALESCE(NULLIF(payload->>'status', ''), 'scheduled'),
    COALESCE(NULLIF(payload->>'source_type', ''), 'manual'),
    NULLIF(payload->>'source_id', '')::uuid,
    COALESCE(NULLIF(payload->>'source_subtype', ''), 'default'),
    NULLIF(payload->>'source_path', ''),
    NULLIF(payload->>'accent', ''),
    NULLIF(payload->>'icon_type', ''),
    v_user_id,
    COALESCE(NULLIF(payload->>'created_by_name', ''), v_user_name),
    NULLIF(payload->>'team_department', ''),
    NULLIF(payload->>'recipient_id', '')::uuid,
    NULLIF(payload->>'client_name', ''),
    NULLIF(payload->>'client_contact', ''),
    COALESCE(payload->'metadata', '{}'::jsonb),
    CASE
      WHEN payload ? 'recurrence_rule' AND payload->'recurrence_rule' <> 'null'::jsonb THEN payload->'recurrence_rule'
      ELSE NULL
    END
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

  IF payload ? 'reminder_minutes' THEN
    INSERT INTO public.calendar_event_reminders (event_id, user_id, reminder_minutes)
    SELECT v_event_id, v_user_id, value::integer
    FROM jsonb_array_elements_text(COALESCE(payload->'reminder_minutes', '[]'::jsonb)) AS value
    WHERE value::integer > 0
    ON CONFLICT DO NOTHING;
  END IF;

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
  v_is_private_personal boolean;
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

  SELECT (
    v_existing.visibility = 'private'
    AND v_existing.source_type = 'manual'
    AND v_existing.team_department IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.calendar_event_resources cer WHERE cer.event_id = v_existing.id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.calendar_event_participants cep
      WHERE cep.event_id = v_existing.id
        AND cep.role IS DISTINCT FROM 'organizer'
    )
  ) INTO v_is_private_personal;

  IF v_existing.created_by <> v_user_id
    AND (
      v_is_private_personal
      OR (
        NOT public.has_role(v_user_id, 'admin'::public.app_role)
        AND NOT public.has_role(v_user_id, 'moderator'::public.app_role)
      )
    )
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
    source_subtype = COALESCE(NULLIF(payload->>'source_subtype', ''), source_subtype),
    source_path = CASE WHEN payload ? 'source_path' THEN NULLIF(payload->>'source_path', '') ELSE source_path END,
    accent = CASE WHEN payload ? 'accent' THEN NULLIF(payload->>'accent', '') ELSE accent END,
    icon_type = CASE WHEN payload ? 'icon_type' THEN NULLIF(payload->>'icon_type', '') ELSE icon_type END,
    team_department = CASE WHEN payload ? 'team_department' THEN NULLIF(payload->>'team_department', '') ELSE team_department END,
    recipient_id = CASE WHEN payload ? 'recipient_id' THEN NULLIF(payload->>'recipient_id', '')::uuid ELSE recipient_id END,
    client_name = CASE WHEN payload ? 'client_name' THEN NULLIF(payload->>'client_name', '') ELSE client_name END,
    client_contact = CASE WHEN payload ? 'client_contact' THEN NULLIF(payload->>'client_contact', '') ELSE client_contact END,
    metadata = COALESCE(payload->'metadata', metadata),
    recurrence_rule = CASE
      WHEN payload ? 'recurrence_rule' AND payload->'recurrence_rule' <> 'null'::jsonb THEN payload->'recurrence_rule'
      WHEN payload ? 'recurrence_rule' THEN NULL
      ELSE recurrence_rule
    END,
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

  IF payload ? 'reminder_minutes' THEN
    DELETE FROM public.calendar_event_reminders
    WHERE event_id = v_event_id
      AND user_id = v_user_id;

    INSERT INTO public.calendar_event_reminders (event_id, user_id, reminder_minutes)
    SELECT v_event_id, v_user_id, value::integer
    FROM jsonb_array_elements_text(COALESCE(payload->'reminder_minutes', '[]'::jsonb)) AS value
    WHERE value::integer > 0
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_event_reminders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_tasks TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_calendar_events(timestamptz, timestamptz, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_calendar_event(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_calendar_event(jsonb) TO authenticated;