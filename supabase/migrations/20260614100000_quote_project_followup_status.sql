ALTER TABLE public.saved_quotes
  ADD COLUMN IF NOT EXISTS project_followup_status TEXT,
  ADD COLUMN IF NOT EXISTS project_followup_note TEXT,
  ADD COLUMN IF NOT EXISTS project_followup_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS project_followup_updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.saved_quotes
  ALTER COLUMN project_followup_status SET DEFAULT 'pending';

UPDATE public.saved_quotes
SET project_followup_status = CASE
  WHEN project_id IS NULL THEN 'pending'
  ELSE 'converted'
END
WHERE project_followup_status IS NULL
   OR project_followup_status NOT IN ('pending', 'not_required', 'converted');

UPDATE public.saved_quotes
SET
  project_followup_status = 'converted',
  project_followup_note = NULL,
  project_followup_updated_at = COALESCE(project_followup_updated_at, now())
WHERE project_id IS NOT NULL
  AND project_followup_status <> 'converted';

ALTER TABLE public.saved_quotes
  ALTER COLUMN project_followup_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'saved_quotes_project_followup_status_check'
      AND conrelid = 'public.saved_quotes'::regclass
  ) THEN
    ALTER TABLE public.saved_quotes
      ADD CONSTRAINT saved_quotes_project_followup_status_check
      CHECK (project_followup_status IN ('pending', 'not_required', 'converted'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_saved_quotes_project_followup_status
  ON public.saved_quotes(project_followup_status);

CREATE INDEX IF NOT EXISTS idx_saved_quotes_project_followup_project
  ON public.saved_quotes(project_followup_status, project_id);

COMMENT ON COLUMN public.saved_quotes.project_followup_status
  IS 'Project conversion follow-up status for issued quotes: pending, not_required, converted.';

COMMENT ON COLUMN public.saved_quotes.project_followup_note
  IS 'Reason or memo for marking project conversion as not required.';
