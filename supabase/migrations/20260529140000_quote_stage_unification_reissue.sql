-- Unify issued quote workflow around saved_quotes.project_stage and add reissue tracking.

ALTER TABLE public.saved_quotes
  ADD COLUMN IF NOT EXISTS auto_cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS reissued_from_quote_id UUID REFERENCES public.saved_quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reissued_quote_id UUID REFERENCES public.saved_quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reissued_at TIMESTAMPTZ;

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

CREATE INDEX IF NOT EXISTS idx_saved_quotes_project_stage
  ON public.saved_quotes(project_stage);

CREATE INDEX IF NOT EXISTS idx_saved_quotes_reissued_from_quote_id
  ON public.saved_quotes(reissued_from_quote_id);

CREATE INDEX IF NOT EXISTS idx_saved_quotes_reissued_quote_id
  ON public.saved_quotes(reissued_quote_id);

CREATE INDEX IF NOT EXISTS idx_saved_quotes_auto_cancelled_at
  ON public.saved_quotes(auto_cancelled_at)
  WHERE auto_cancelled_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.quote_status_recovery_backup_20260529 AS
SELECT *
FROM public.saved_quotes;

CREATE TABLE IF NOT EXISTS public.quote_status_recovery_review_20260529 (
  quote_id UUID PRIMARY KEY,
  quote_number TEXT,
  project_id UUID,
  current_project_stage TEXT,
  current_quote_status TEXT,
  suggested_project_stage TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

WITH latest_stage_history AS (
  SELECT DISTINCT ON (quote_id)
    quote_id,
    new_stage,
    created_at
  FROM public.quote_stage_history
  WHERE new_stage IN (
    'reviewing',
    'quote_issued',
    'revision_requested',
    'on_hold',
    'contracted',
    'invoice_issued',
    'in_progress',
    'panel_ordered',
    'manufacturing',
    'completed',
    'cancelled'
  )
  ORDER BY quote_id, created_at DESC
),
latest_activity_history AS (
  SELECT DISTINCT ON (quote_id)
    quote_id,
    CASE new_value
      WHEN 'sent' THEN 'quote_issued'
      WHEN 'won' THEN 'contracted'
      WHEN 'reviewing' THEN 'reviewing'
      WHEN 'revision_requested' THEN 'revision_requested'
      WHEN 'on_hold' THEN 'on_hold'
      WHEN 'cancelled' THEN 'cancelled'
      WHEN 'quote_issued' THEN 'quote_issued'
      WHEN 'contracted' THEN 'contracted'
      WHEN 'invoice_issued' THEN 'invoice_issued'
      WHEN 'in_progress' THEN 'in_progress'
      WHEN 'panel_ordered' THEN 'panel_ordered'
      WHEN 'manufacturing' THEN 'manufacturing'
      WHEN 'completed' THEN 'completed'
      ELSE NULL
    END AS mapped_stage,
    created_at
  FROM public.quote_activity_history
  WHERE action_type = 'status_changed'
  ORDER BY quote_id, created_at DESC
),
recovery_candidates AS (
  SELECT
    sq.id,
    sq.quote_number,
    sq.project_id,
    sq.project_stage,
    sq.quote_status,
    COALESCE(lsh.new_stage, lah.mapped_stage) AS suggested_stage,
    CASE
      WHEN lsh.new_stage IS NOT NULL THEN 'latest_quote_stage_history'
      WHEN lah.mapped_stage IS NOT NULL THEN 'latest_quote_activity_history'
      WHEN sq.project_id IS NOT NULL THEN 'linked_project_needs_review'
      ELSE 'cancelled_without_clear_recovery_signal'
    END AS reason
  FROM public.saved_quotes sq
  LEFT JOIN latest_stage_history lsh ON lsh.quote_id = sq.id
  LEFT JOIN latest_activity_history lah ON lah.quote_id = sq.id
  WHERE sq.project_stage = 'cancelled'
    AND sq.quote_status = 'cancelled'
)
INSERT INTO public.quote_status_recovery_review_20260529 (
  quote_id,
  quote_number,
  project_id,
  current_project_stage,
  current_quote_status,
  suggested_project_stage,
  reason
)
SELECT
  id,
  quote_number,
  project_id,
  project_stage,
  quote_status,
  suggested_stage,
  reason
FROM recovery_candidates
WHERE suggested_stage IS DISTINCT FROM 'cancelled'
   OR project_id IS NOT NULL
ON CONFLICT (quote_id) DO UPDATE
SET
  quote_number = EXCLUDED.quote_number,
  project_id = EXCLUDED.project_id,
  current_project_stage = EXCLUDED.current_project_stage,
  current_quote_status = EXCLUDED.current_quote_status,
  suggested_project_stage = EXCLUDED.suggested_project_stage,
  reason = EXCLUDED.reason;

WITH latest_stage_history AS (
  SELECT DISTINCT ON (quote_id)
    quote_id,
    new_stage
  FROM public.quote_stage_history
  WHERE new_stage IN (
    'reviewing',
    'quote_issued',
    'revision_requested',
    'on_hold',
    'contracted',
    'invoice_issued',
    'in_progress',
    'panel_ordered',
    'manufacturing',
    'completed'
  )
  ORDER BY quote_id, created_at DESC
),
latest_activity_history AS (
  SELECT DISTINCT ON (quote_id)
    quote_id,
    CASE new_value
      WHEN 'sent' THEN 'quote_issued'
      WHEN 'won' THEN 'contracted'
      WHEN 'reviewing' THEN 'reviewing'
      WHEN 'revision_requested' THEN 'revision_requested'
      WHEN 'on_hold' THEN 'on_hold'
      WHEN 'quote_issued' THEN 'quote_issued'
      WHEN 'contracted' THEN 'contracted'
      WHEN 'invoice_issued' THEN 'invoice_issued'
      WHEN 'in_progress' THEN 'in_progress'
      WHEN 'panel_ordered' THEN 'panel_ordered'
      WHEN 'manufacturing' THEN 'manufacturing'
      WHEN 'completed' THEN 'completed'
      ELSE NULL
    END AS mapped_stage
  FROM public.quote_activity_history
  WHERE action_type = 'status_changed'
  ORDER BY quote_id, created_at DESC
),
restorable AS (
  SELECT
    sq.id,
    COALESCE(lsh.new_stage, lah.mapped_stage) AS recovered_stage
  FROM public.saved_quotes sq
  LEFT JOIN latest_stage_history lsh ON lsh.quote_id = sq.id
  LEFT JOIN latest_activity_history lah ON lah.quote_id = sq.id
  WHERE sq.project_stage = 'cancelled'
    AND sq.quote_status = 'cancelled'
    AND COALESCE(lsh.new_stage, lah.mapped_stage) IS NOT NULL
)
UPDATE public.saved_quotes sq
SET
  project_stage = restorable.recovered_stage,
  quote_status = CASE
    WHEN restorable.recovered_stage IN ('reviewing') THEN 'reviewing'
    WHEN restorable.recovered_stage IN ('revision_requested') THEN 'revision_requested'
    WHEN restorable.recovered_stage IN ('on_hold') THEN 'on_hold'
    WHEN restorable.recovered_stage IN ('contracted', 'invoice_issued', 'in_progress', 'panel_ordered', 'manufacturing', 'completed') THEN 'won'
    WHEN restorable.recovered_stage = 'cancelled' THEN 'cancelled'
    ELSE 'sent'
  END,
  status_updated_at = now()
FROM restorable
WHERE sq.id = restorable.id;

WITH normalized AS (
  SELECT
    id,
    CASE
      WHEN project_stage IN ('contracted', 'invoice_issued', 'in_progress', 'panel_ordered', 'manufacturing', 'completed', 'cancelled') THEN project_stage
      WHEN quote_status = 'reviewing' THEN 'reviewing'
      WHEN quote_status = 'revision_requested' THEN 'revision_requested'
      WHEN quote_status = 'on_hold' THEN 'on_hold'
      WHEN quote_status = 'won' THEN 'contracted'
      WHEN quote_status = 'cancelled' THEN 'cancelled'
      WHEN project_stage IN ('reviewing', 'quote_issued', 'revision_requested', 'on_hold') THEN project_stage
      ELSE 'quote_issued'
    END AS normalized_stage
  FROM public.saved_quotes
)
UPDATE public.saved_quotes sq
SET
  project_stage = normalized.normalized_stage,
  quote_status = CASE
    WHEN normalized.normalized_stage = 'reviewing' THEN 'reviewing'
    WHEN normalized.normalized_stage = 'revision_requested' THEN 'revision_requested'
    WHEN normalized.normalized_stage = 'on_hold' THEN 'on_hold'
    WHEN normalized.normalized_stage IN ('contracted', 'invoice_issued', 'in_progress', 'panel_ordered', 'manufacturing', 'completed') THEN 'won'
    WHEN normalized.normalized_stage = 'cancelled' THEN 'cancelled'
    ELSE 'sent'
  END,
  status_updated_at = COALESCE(sq.status_updated_at, sq.updated_at, sq.created_at, now())
FROM normalized
WHERE sq.id = normalized.id;

COMMENT ON COLUMN public.saved_quotes.project_stage IS 'Single workflow stage for issued quotes, from quote review through production completion.';
COMMENT ON COLUMN public.saved_quotes.quote_status IS 'Legacy compatibility status derived from project_stage; new UI writes project_stage.';
COMMENT ON COLUMN public.saved_quotes.auto_cancelled_at IS 'Timestamp set only by guarded server-side auto-expiration.';
COMMENT ON COLUMN public.saved_quotes.auto_cancel_reason IS 'Reason set by guarded server-side auto-expiration.';
COMMENT ON COLUMN public.saved_quotes.reissued_from_quote_id IS 'Original quote id when this quote is a reissue.';
COMMENT ON COLUMN public.saved_quotes.reissued_quote_id IS 'Latest reissued quote id when this quote has been reissued.';
COMMENT ON TABLE public.quote_status_recovery_backup_20260529 IS 'Full saved_quotes backup before project_stage-based status unification.';
COMMENT ON TABLE public.quote_status_recovery_review_20260529 IS 'Quotes requiring manual review after status recovery.';
