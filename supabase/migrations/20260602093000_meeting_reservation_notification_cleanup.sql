-- Prevent meeting reservation creators from appearing as attendees and retire stale meeting notifications.

UPDATE public.meeting_reservations mr
SET
  participant_ids = COALESCE((
    SELECT array_agg(participant_id ORDER BY ord)
    FROM unnest(COALESCE(mr.participant_ids, '{}'::uuid[])) WITH ORDINALITY AS t(participant_id, ord)
    WHERE participant_id IS DISTINCT FROM mr.created_by
  ), '{}'::uuid[]),
  participant_names = COALESCE((
    SELECT array_agg(participant_name ORDER BY ord)
    FROM unnest(COALESCE(mr.participant_names, '{}'::text[])) WITH ORDINALITY AS t(participant_name, ord)
    WHERE participant_name IS NOT NULL
      AND participant_name <> COALESCE(mr.created_by_name, '')
  ), '{}'::text[])
WHERE mr.created_by = ANY(COALESCE(mr.participant_ids, '{}'::uuid[]))
   OR COALESCE(mr.created_by_name, '') = ANY(COALESCE(mr.participant_names, '{}'::text[]));

WITH stale_meeting_notifications AS (
  SELECT n.id
  FROM public.notifications n
  LEFT JOIN public.meeting_reservations mr
    ON mr.id = CASE
      WHEN (n.data->>'meetingReservationId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (n.data->>'meetingReservationId')::uuid
      ELSE NULL
    END
  WHERE n.type IN ('meeting_reservation', 'meeting_reservation_status')
    AND COALESCE(n.is_read, false) IS FALSE
    AND (n.data->>'meetingReservationId') IS NOT NULL
    AND (
      mr.id IS NULL
      OR mr.status IN ('completed', 'canceled')
      OR (
        CASE
          WHEN mr.end_time IS NULL OR mr.end_time = ''
            THEN public.calendar_meeting_start_at(mr.meeting_date, COALESCE(NULLIF(mr.start_time, ''), '10:00')) + interval '1 hour'
          WHEN public.calendar_meeting_start_at(mr.meeting_date, mr.end_time)
            <= public.calendar_meeting_start_at(mr.meeting_date, COALESCE(NULLIF(mr.start_time, ''), '10:00'))
            THEN public.calendar_meeting_start_at(mr.meeting_date, COALESCE(NULLIF(mr.start_time, ''), '10:00')) + interval '1 hour'
          ELSE public.calendar_meeting_start_at(mr.meeting_date, mr.end_time)
        END
      ) <= now()
    )
)
UPDATE public.notifications n
SET is_read = true
FROM stale_meeting_notifications stale
WHERE n.id = stale.id;

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
      AND (v.can_manage_all OR v.is_owner)
    ) AS can_edit,
    NOT (v.has_full_access OR v.visibility = 'details') AS is_redacted,
    CASE WHEN v.has_full_access OR v.visibility = 'details' THEN v.metadata ELSE '{}'::jsonb END AS metadata
  FROM visible v
  ORDER BY v.starts_at ASC, v.title ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_calendar_events(timestamptz, timestamptz, jsonb) TO authenticated;
