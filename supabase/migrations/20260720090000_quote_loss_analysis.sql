-- Quote loss analysis metadata for client cancellations and failed wins.
ALTER TABLE public.saved_quotes
  ADD COLUMN IF NOT EXISTS lost_reason_category TEXT,
  ADD COLUMN IF NOT EXISTS lost_reason_detail TEXT,
  ADD COLUMN IF NOT EXISTS lost_by TEXT,
  ADD COLUMN IF NOT EXISTS lost_competitor_name TEXT,
  ADD COLUMN IF NOT EXISTS lost_price_gap NUMERIC,
  ADD COLUMN IF NOT EXISTS lost_follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lost_recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lost_recorded_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'saved_quotes_lost_by_check'
      AND conrelid = 'public.saved_quotes'::regclass
  ) THEN
    ALTER TABLE public.saved_quotes
      ADD CONSTRAINT saved_quotes_lost_by_check
      CHECK (
        lost_by IS NULL OR lost_by IN ('client', 'internal', 'expired', 'system')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'saved_quotes_lost_reason_category_check'
      AND conrelid = 'public.saved_quotes'::regclass
  ) THEN
    ALTER TABLE public.saved_quotes
      ADD CONSTRAINT saved_quotes_lost_reason_category_check
      CHECK (
        lost_reason_category IS NULL OR lost_reason_category IN (
          'price_too_high',
          'lead_time',
          'spec_mismatch',
          'competitor_selected',
          'client_budget_cancelled',
          'no_response',
          'internal_rejected',
          'duplicate_or_test',
          'other'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_saved_quotes_lost_recorded_at
  ON public.saved_quotes(lost_recorded_at DESC)
  WHERE lost_recorded_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_saved_quotes_lost_reason_category
  ON public.saved_quotes(lost_reason_category)
  WHERE lost_reason_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_saved_quotes_lost_recorded_by
  ON public.saved_quotes(lost_recorded_by)
  WHERE lost_recorded_by IS NOT NULL;

COMMENT ON COLUMN public.saved_quotes.lost_reason_category IS 'Structured reason category for quote loss/cancellation analysis.';
COMMENT ON COLUMN public.saved_quotes.lost_reason_detail IS 'Required staff note describing why the quote was lost or cancelled.';
COMMENT ON COLUMN public.saved_quotes.lost_by IS 'Actor/source of quote loss: client, internal, expired, or system.';
COMMENT ON COLUMN public.saved_quotes.lost_competitor_name IS 'Optional competitor selected by the client.';
COMMENT ON COLUMN public.saved_quotes.lost_price_gap IS 'Optional known price gap against competitor or customer budget.';
COMMENT ON COLUMN public.saved_quotes.lost_follow_up_at IS 'Optional date/time for future re-contact after quote loss.';
COMMENT ON COLUMN public.saved_quotes.lost_recorded_by IS 'User who recorded the quote loss reason.';
COMMENT ON COLUMN public.saved_quotes.lost_recorded_at IS 'Timestamp when the quote loss reason was recorded.';
