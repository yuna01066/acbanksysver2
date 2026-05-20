-- Separate quote workflow status from production/project stage.

ALTER TABLE public.saved_quotes
  ADD COLUMN IF NOT EXISTS quote_status TEXT NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to_name TEXT,
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.saved_quotes
  DROP CONSTRAINT IF EXISTS saved_quotes_quote_status_check;

ALTER TABLE public.saved_quotes
  ADD CONSTRAINT saved_quotes_quote_status_check
  CHECK (quote_status IN (
    'draft',
    'reviewing',
    'sent',
    'revision_requested',
    'won',
    'on_hold',
    'cancelled'
  ));

UPDATE public.saved_quotes
SET
  quote_status = CASE
    WHEN project_stage = 'cancelled' THEN 'cancelled'
    ELSE COALESCE(NULLIF(quote_status, ''), 'sent')
  END,
  status_updated_at = COALESCE(status_updated_at, updated_at, created_at, now());

UPDATE public.saved_quotes sq
SET
  assigned_to = COALESCE(sq.assigned_to, sq.issuer_id, sq.user_id),
  assigned_to_name = COALESCE(
    NULLIF(sq.assigned_to_name, ''),
    NULLIF(sq.issuer_name, ''),
    NULLIF(p.full_name, ''),
    NULLIF(p.email, '')
  )
FROM public.profiles p
WHERE p.id = COALESCE(sq.issuer_id, sq.user_id)
  AND (sq.assigned_to IS NULL OR sq.assigned_to_name IS NULL OR sq.assigned_to_name = '');

UPDATE public.saved_quotes
SET
  assigned_to_name = COALESCE(NULLIF(assigned_to_name, ''), NULLIF(issuer_name, ''))
WHERE assigned_to_name IS NULL OR assigned_to_name = '';

CREATE INDEX IF NOT EXISTS idx_saved_quotes_quote_status
  ON public.saved_quotes(quote_status);

CREATE INDEX IF NOT EXISTS idx_saved_quotes_assigned_to
  ON public.saved_quotes(assigned_to);

CREATE INDEX IF NOT EXISTS idx_saved_quotes_status_updated_at
  ON public.saved_quotes(status_updated_at DESC);

CREATE TABLE IF NOT EXISTS public.quote_activity_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.saved_quotes(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  actor_id UUID NOT NULL,
  actor_name TEXT NOT NULL,
  memo TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_activity_history_quote_created
  ON public.quote_activity_history(quote_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_activity_history_action_type
  ON public.quote_activity_history(action_type);

ALTER TABLE public.quote_activity_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view quote activity history"
  ON public.quote_activity_history;
CREATE POLICY "Authenticated users can view quote activity history"
  ON public.quote_activity_history
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert quote activity history"
  ON public.quote_activity_history;
CREATE POLICY "Authenticated users can insert quote activity history"
  ON public.quote_activity_history
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND actor_id = auth.uid());

COMMENT ON COLUMN public.saved_quotes.quote_status IS 'Quote workflow status independent from project_stage production progress';
COMMENT ON COLUMN public.saved_quotes.assigned_to IS 'User responsible for quote follow-up';
COMMENT ON TABLE public.quote_activity_history IS 'Unified quote activity timeline for status, assignee, memo, file, project, and edit events';
