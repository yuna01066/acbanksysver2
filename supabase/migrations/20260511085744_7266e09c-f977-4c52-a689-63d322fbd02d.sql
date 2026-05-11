ALTER TABLE public.space_project_quotes
  ADD COLUMN IF NOT EXISTS issuer_id uuid,
  ADD COLUMN IF NOT EXISTS issuer_name text,
  ADD COLUMN IF NOT EXISTS issuer_email text,
  ADD COLUMN IF NOT EXISTS issuer_phone text,
  ADD COLUMN IF NOT EXISTS issuer_department text,
  ADD COLUMN IF NOT EXISTS issuer_position text;