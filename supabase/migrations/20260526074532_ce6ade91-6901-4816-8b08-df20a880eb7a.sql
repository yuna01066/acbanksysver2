-- =========================================================
-- 20260526020500_link_announcements_meeting_reservations.sql
-- (Wrapped guarded: skip if meeting_reservations table not yet created;
-- the repair migration below will create it AND perform link + backfill.)
-- =========================================================
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='meeting_reservations') THEN
    EXECUTE $sql$
      ALTER TABLE public.meeting_reservations
        ADD COLUMN IF NOT EXISTS source_announcement_id uuid
        REFERENCES public.announcements(id) ON DELETE SET NULL;
    $sql$;
    EXECUTE $sql$
      ALTER TABLE public.announcements
        ADD COLUMN IF NOT EXISTS meeting_reservation_id uuid
        REFERENCES public.meeting_reservations(id) ON DELETE SET NULL;
    $sql$;
  END IF;
END $outer$;

-- =========================================================
-- 20260526070000_repair_meeting_reservations_table.sql
-- =========================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.meeting_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_type text NOT NULL CHECK (audience_type IN ('employee', 'client')),
  employee_meeting_type text NULL CHECK (
    employee_meeting_type IS NULL
    OR employee_meeting_type IN ('one_on_one', 'all_hands', 'team')
  ),
  client_meeting_type text NULL CHECK (
    client_meeting_type IS NULL
    OR client_meeting_type IN ('showroom_visit', 'production_consulting', 'external_meeting', 'exhibition_onsite', 'other')
  ),
  title text NOT NULL,
  description text NULL,
  meeting_date date NOT NULL,
  start_time text NOT NULL,
  end_time text NULL,
  location text NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'canceled')),
  recipient_id uuid NULL REFERENCES public.recipients(id) ON DELETE SET NULL,
  client_name text NULL,
  client_contact text NULL,
  participant_ids uuid[] NOT NULL DEFAULT '{}',
  participant_names text[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  created_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source_announcement_id uuid NULL REFERENCES public.announcements(id) ON DELETE SET NULL,
  CONSTRAINT meeting_reservations_employee_type_required CHECK (
    (audience_type = 'employee' AND employee_meeting_type IS NOT NULL AND client_meeting_type IS NULL)
    OR audience_type = 'client'
  ),
  CONSTRAINT meeting_reservations_client_type_required CHECK (
    (audience_type = 'client' AND client_meeting_type IS NOT NULL AND employee_meeting_type IS NULL)
    OR audience_type = 'employee'
  )
);

ALTER TABLE public.meeting_reservations
  ADD COLUMN IF NOT EXISTS audience_type text NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS employee_meeting_type text NULL,
  ADD COLUMN IF NOT EXISTS client_meeting_type text NULL,
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description text NULL,
  ADD COLUMN IF NOT EXISTS meeting_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS start_time text NOT NULL DEFAULT '10:00',
  ADD COLUMN IF NOT EXISTS end_time text NULL,
  ADD COLUMN IF NOT EXISTS location text NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS recipient_id uuid NULL,
  ADD COLUMN IF NOT EXISTS client_name text NULL,
  ADD COLUMN IF NOT EXISTS client_contact text NULL,
  ADD COLUMN IF NOT EXISTS participant_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS participant_names text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_by uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  ADD COLUMN IF NOT EXISTS created_by_name text NOT NULL DEFAULT '담당자',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS source_announcement_id uuid NULL;

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS meeting_reservation_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'meeting_reservations_recipient_id_fkey'
      AND conrelid = 'public.meeting_reservations'::regclass
  ) THEN
    ALTER TABLE public.meeting_reservations
      ADD CONSTRAINT meeting_reservations_recipient_id_fkey
      FOREIGN KEY (recipient_id) REFERENCES public.recipients(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'meeting_reservations_source_announcement_id_fkey'
      AND conrelid = 'public.meeting_reservations'::regclass
  ) THEN
    ALTER TABLE public.meeting_reservations
      ADD CONSTRAINT meeting_reservations_source_announcement_id_fkey
      FOREIGN KEY (source_announcement_id) REFERENCES public.announcements(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'announcements_meeting_reservation_id_fkey'
      AND conrelid = 'public.announcements'::regclass
  ) THEN
    ALTER TABLE public.announcements
      ADD CONSTRAINT announcements_meeting_reservation_id_fkey
      FOREIGN KEY (meeting_reservation_id) REFERENCES public.meeting_reservations(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'meeting_reservations_employee_type_required'
      AND conrelid = 'public.meeting_reservations'::regclass
  ) THEN
    ALTER TABLE public.meeting_reservations
      ADD CONSTRAINT meeting_reservations_employee_type_required CHECK (
        (audience_type = 'employee' AND employee_meeting_type IS NOT NULL AND client_meeting_type IS NULL)
        OR audience_type = 'client'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'meeting_reservations_client_type_required'
      AND conrelid = 'public.meeting_reservations'::regclass
  ) THEN
    ALTER TABLE public.meeting_reservations
      ADD CONSTRAINT meeting_reservations_client_type_required CHECK (
        (audience_type = 'client' AND client_meeting_type IS NOT NULL AND employee_meeting_type IS NULL)
        OR audience_type = 'employee'
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_meeting_reservations_date_time
  ON public.meeting_reservations(meeting_date, start_time);
CREATE INDEX IF NOT EXISTS idx_meeting_reservations_created_by
  ON public.meeting_reservations(created_by);
CREATE INDEX IF NOT EXISTS idx_meeting_reservations_status
  ON public.meeting_reservations(status);
CREATE INDEX IF NOT EXISTS idx_meeting_reservations_recipient_id
  ON public.meeting_reservations(recipient_id);
CREATE INDEX IF NOT EXISTS idx_meeting_reservations_participant_ids
  ON public.meeting_reservations USING gin(participant_ids);
CREATE INDEX IF NOT EXISTS idx_meeting_reservations_source_announcement_id
  ON public.meeting_reservations(source_announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcements_meeting_reservation_id
  ON public.announcements(meeting_reservation_id);

ALTER TABLE public.meeting_reservations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meeting_reservations' AND policyname='Authenticated users can read meeting reservations') THEN
    CREATE POLICY "Authenticated users can read meeting reservations"
    ON public.meeting_reservations FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meeting_reservations' AND policyname='Users can create meeting reservations') THEN
    CREATE POLICY "Users can create meeting reservations"
    ON public.meeting_reservations FOR INSERT WITH CHECK (auth.uid() = created_by);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meeting_reservations' AND policyname='Creators can update their meeting reservations') THEN
    CREATE POLICY "Creators can update their meeting reservations"
    ON public.meeting_reservations FOR UPDATE USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meeting_reservations' AND policyname='Creators can delete their meeting reservations') THEN
    CREATE POLICY "Creators can delete their meeting reservations"
    ON public.meeting_reservations FOR DELETE USING (auth.uid() = created_by);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meeting_reservations' AND policyname='Admins can manage meeting reservations') THEN
    CREATE POLICY "Admins can manage meeting reservations"
    ON public.meeting_reservations FOR ALL
    USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meeting_reservations' AND policyname='Moderators can manage meeting reservations') THEN
    CREATE POLICY "Moderators can manage meeting reservations"
    ON public.meeting_reservations FOR ALL
    USING (public.has_role(auth.uid(), 'moderator'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'moderator'::public.app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meeting_reservations' AND policyname='Managers can manage meeting reservations') THEN
    CREATE POLICY "Managers can manage meeting reservations"
    ON public.meeting_reservations FOR ALL
    USING (public.has_role(auth.uid(), 'manager'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'manager'::public.app_role));
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_meeting_reservations_updated_at ON public.meeting_reservations;
CREATE TRIGGER update_meeting_reservations_updated_at
BEFORE UPDATE ON public.meeting_reservations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill: create meeting_reservations for conference/meeting announcements
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
      SELECT 1 FROM public.meeting_reservations mr
      WHERE mr.source_announcement_id = a.id
    )
),
inserted_reservations AS (
  INSERT INTO public.meeting_reservations (
    audience_type, employee_meeting_type, client_meeting_type,
    title, description, meeting_date, start_time, end_time, location, status,
    recipient_id, client_name, client_contact,
    participant_ids, participant_names,
    created_by, created_by_name, created_at, updated_at, source_announcement_id
  )
  SELECT
    CASE WHEN announcement_type = 'conference' THEN 'employee' ELSE 'client' END,
    CASE WHEN announcement_type = 'conference' THEN 'all_hands' ELSE NULL END,
    CASE WHEN announcement_type = 'meeting' THEN 'other' ELSE NULL END,
    title, content, meeting_date, safe_start_time,
    to_char((date '2000-01-01' + safe_start_time::time + interval '1 hour'), 'HH24:MI'),
    meeting_location, 'scheduled',
    CASE WHEN announcement_type = 'meeting' THEN recipient_id ELSE NULL END,
    CASE WHEN announcement_type = 'meeting' THEN recipient_name ELSE NULL END,
    NULL,
    CASE WHEN announcement_type = 'meeting' THEN COALESCE(assignee_ids, '{}') ELSE '{}'::uuid[] END,
    CASE WHEN announcement_type = 'meeting' THEN COALESCE(assignee_names, '{}') ELSE '{}'::text[] END,
    author_id, author_name, created_at, updated_at, id
  FROM schedulable_announcements
  RETURNING id, source_announcement_id
)
UPDATE public.announcements a
SET meeting_reservation_id = inserted_reservations.id
FROM inserted_reservations
WHERE a.id = inserted_reservations.source_announcement_id;

NOTIFY pgrst, 'reload schema';