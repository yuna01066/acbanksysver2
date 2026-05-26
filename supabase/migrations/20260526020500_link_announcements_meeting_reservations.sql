-- Link announcement conference/meeting posts with independent meeting reservations.
ALTER TABLE public.meeting_reservations
  ADD COLUMN IF NOT EXISTS source_announcement_id uuid
  REFERENCES public.announcements(id) ON DELETE SET NULL;

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS meeting_reservation_id uuid
  REFERENCES public.meeting_reservations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_reservations_source_announcement_id
  ON public.meeting_reservations(source_announcement_id);

CREATE INDEX IF NOT EXISTS idx_announcements_meeting_reservation_id
  ON public.announcements(meeting_reservation_id);

WITH schedulable_announcements AS (
  SELECT
    a.*,
    CASE
      WHEN a.meeting_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN a.meeting_time
      ELSE '10:00'
    END AS safe_start_time
  FROM public.announcements a
  WHERE a.announcement_type IN ('conference', 'meeting')
    AND a.meeting_date IS NOT NULL
    AND a.meeting_reservation_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.meeting_reservations mr
      WHERE mr.source_announcement_id = a.id
    )
),
inserted_reservations AS (
  INSERT INTO public.meeting_reservations (
    audience_type,
    employee_meeting_type,
    client_meeting_type,
    title,
    description,
    meeting_date,
    start_time,
    end_time,
    location,
    status,
    recipient_id,
    client_name,
    client_contact,
    participant_ids,
    participant_names,
    created_by,
    created_by_name,
    created_at,
    updated_at,
    source_announcement_id
  )
  SELECT
    CASE WHEN announcement_type = 'conference' THEN 'employee' ELSE 'client' END,
    CASE WHEN announcement_type = 'conference' THEN 'all_hands' ELSE NULL END,
    CASE WHEN announcement_type = 'meeting' THEN 'other' ELSE NULL END,
    title,
    content,
    meeting_date,
    safe_start_time,
    to_char((date '2000-01-01' + safe_start_time::time + interval '1 hour'), 'HH24:MI'),
    meeting_location,
    'scheduled',
    CASE WHEN announcement_type = 'meeting' THEN recipient_id ELSE NULL END,
    CASE WHEN announcement_type = 'meeting' THEN recipient_name ELSE NULL END,
    NULL,
    CASE WHEN announcement_type = 'meeting' THEN COALESCE(assignee_ids, '{}') ELSE '{}'::uuid[] END,
    CASE WHEN announcement_type = 'meeting' THEN COALESCE(assignee_names, '{}') ELSE '{}'::text[] END,
    author_id,
    author_name,
    created_at,
    updated_at,
    id
  FROM schedulable_announcements
  RETURNING id, source_announcement_id
)
UPDATE public.announcements a
SET meeting_reservation_id = inserted_reservations.id
FROM inserted_reservations
WHERE a.id = inserted_reservations.source_announcement_id;
