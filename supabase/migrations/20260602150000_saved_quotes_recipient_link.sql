ALTER TABLE public.saved_quotes
  ADD COLUMN IF NOT EXISTS recipient_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'saved_quotes_recipient_id_fkey'
  ) THEN
    ALTER TABLE public.saved_quotes
      ADD CONSTRAINT saved_quotes_recipient_id_fkey
      FOREIGN KEY (recipient_id)
      REFERENCES public.recipients(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_saved_quotes_recipient_id
  ON public.saved_quotes(recipient_id)
  WHERE recipient_id IS NOT NULL;

UPDATE public.saved_quotes sq
SET recipient_id = r.id
FROM public.recipients r
WHERE sq.recipient_id IS NULL
  AND sq.user_id = r.user_id
  AND NULLIF(BTRIM(sq.recipient_company), '') = r.company_name
  AND NULLIF(BTRIM(sq.recipient_name), '') = r.contact_person;
