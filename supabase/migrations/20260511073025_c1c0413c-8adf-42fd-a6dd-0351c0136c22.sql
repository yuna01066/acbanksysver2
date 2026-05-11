ALTER TABLE public.space_project_quotes
  ADD COLUMN IF NOT EXISTS client_business_number TEXT,
  ADD COLUMN IF NOT EXISTS client_business_name TEXT,
  ADD COLUMN IF NOT EXISTS client_representative TEXT,
  ADD COLUMN IF NOT EXISTS client_business_type TEXT,
  ADD COLUMN IF NOT EXISTS client_business_item TEXT,
  ADD COLUMN IF NOT EXISTS client_business_address TEXT,
  ADD COLUMN IF NOT EXISTS client_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS client_contact_position TEXT,
  ADD COLUMN IF NOT EXISTS client_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS client_contact_email TEXT;