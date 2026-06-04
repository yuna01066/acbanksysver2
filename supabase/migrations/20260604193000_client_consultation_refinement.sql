CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.client_consultation_leads
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.recipients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_status TEXT NOT NULL DEFAULT 'not_contacted',
  ADD COLUMN IF NOT EXISTS submission_token TEXT,
  ADD COLUMN IF NOT EXISTS quality_score INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_consultation_leads_priority_check'
      AND conrelid = 'public.client_consultation_leads'::regclass
  ) THEN
    ALTER TABLE public.client_consultation_leads
      ADD CONSTRAINT client_consultation_leads_priority_check
      CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_consultation_leads_response_status_check'
      AND conrelid = 'public.client_consultation_leads'::regclass
  ) THEN
    ALTER TABLE public.client_consultation_leads
      ADD CONSTRAINT client_consultation_leads_response_status_check
      CHECK (response_status IN ('not_contacted', 'contacted', 'waiting_client', 'quoted', 'done'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_consultation_leads_quality_score_check'
      AND conrelid = 'public.client_consultation_leads'::regclass
  ) THEN
    ALTER TABLE public.client_consultation_leads
      ADD CONSTRAINT client_consultation_leads_quality_score_check
      CHECK (quality_score BETWEEN 0 AND 100);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_consultation_leads_submission_token
  ON public.client_consultation_leads(source, submission_token)
  WHERE submission_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_consultation_leads_recipient_id
  ON public.client_consultation_leads(recipient_id)
  WHERE recipient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_consultation_leads_follow_up
  ON public.client_consultation_leads(follow_up_at)
  WHERE follow_up_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.client_consultation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.client_consultation_leads(id) ON DELETE CASCADE,
  item_name TEXT,
  width TEXT,
  height TEXT,
  thickness TEXT,
  quantity TEXT,
  unit TEXT,
  color_name TEXT,
  processing_options TEXT[] NOT NULL DEFAULT '{}',
  memo TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_consultation_items_lead_order
  ON public.client_consultation_items(lead_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS public.client_consultation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.client_consultation_leads(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_consultation_events_type_check
    CHECK (event_type IN (
      'submitted',
      'assigned',
      'status_changed',
      'recipient_linked',
      'quote_draft_created',
      'project_created',
      'closed',
      'memo_updated'
    ))
);

CREATE INDEX IF NOT EXISTS idx_client_consultation_events_lead_created
  ON public.client_consultation_events(lead_id, created_at DESC);

ALTER TABLE public.client_consultation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_consultation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and assignees can view client consultation items" ON public.client_consultation_items;
CREATE POLICY "Admins and assignees can view client consultation items"
ON public.client_consultation_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.client_consultation_leads lead
    WHERE lead.id = client_consultation_items.lead_id
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'moderator'::public.app_role)
        OR public.has_role(auth.uid(), 'manager'::public.app_role)
        OR lead.assigned_to = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS "Admins and assignees can view client consultation events" ON public.client_consultation_events;
CREATE POLICY "Admins and assignees can view client consultation events"
ON public.client_consultation_events
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.client_consultation_leads lead
    WHERE lead.id = client_consultation_events.lead_id
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'moderator'::public.app_role)
        OR public.has_role(auth.uid(), 'manager'::public.app_role)
        OR lead.assigned_to = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS "Admins and assignees can insert client consultation events" ON public.client_consultation_events;
CREATE POLICY "Admins and assignees can insert client consultation events"
ON public.client_consultation_events
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.client_consultation_leads lead
    WHERE lead.id = client_consultation_events.lead_id
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'moderator'::public.app_role)
        OR public.has_role(auth.uid(), 'manager'::public.app_role)
        OR lead.assigned_to = auth.uid()
      )
  )
  AND (actor_id IS NULL OR actor_id = auth.uid())
);

GRANT SELECT ON public.client_consultation_items TO authenticated;
GRANT SELECT, INSERT ON public.client_consultation_events TO authenticated;
GRANT ALL ON public.client_consultation_items TO service_role;
GRANT ALL ON public.client_consultation_events TO service_role;

COMMENT ON TABLE public.client_consultation_items IS 'Structured production item rows submitted through the public client consultation widget.';
COMMENT ON TABLE public.client_consultation_events IS 'Audit timeline for client consultation lead handling and conversion actions.';
