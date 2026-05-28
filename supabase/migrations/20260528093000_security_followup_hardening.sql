-- Follow-up hardening for Lovable/Supabase scanner findings.
-- Keep staff-facing safe read surfaces, but remove security-definer views and
-- avoid granting broad access to sensitive base tables.

-- ---------------------------------------------------------------------------
-- Replace safe read views with RLS-protected projection tables.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'profile_directory'
      AND c.relkind = 'v'
  ) THEN
    EXECUTE 'DROP VIEW public.profile_directory';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'checked_in_employee_status'
      AND c.relkind = 'v'
  ) THEN
    EXECUTE 'DROP VIEW public.checked_in_employee_status';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'company_public_info'
      AND c.relkind = 'v'
  ) THEN
    EXECUTE 'DROP VIEW public.company_public_info';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'company_quote_defaults'
      AND c.relkind = 'v'
  ) THEN
    EXECUTE 'DROP VIEW public.company_quote_defaults';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.profile_directory (
  id uuid PRIMARY KEY,
  full_name text,
  department text,
  position text,
  job_title text,
  rank_title text,
  avatar_url text,
  is_approved boolean NOT NULL DEFAULT false,
  synced_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_directory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read profile directory" ON public.profile_directory;
CREATE POLICY "Authenticated users can read profile directory"
ON public.profile_directory
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.sync_profile_directory_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.profile_directory WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.is_approved IS TRUE THEN
    INSERT INTO public.profile_directory (
      id, full_name, department, position, job_title, rank_title, avatar_url, is_approved, synced_at
    )
    VALUES (
      NEW.id, NEW.full_name, NEW.department, NEW.position, NEW.job_title, NEW.rank_title, NEW.avatar_url, NEW.is_approved, now()
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      department = EXCLUDED.department,
      position = EXCLUDED.position,
      job_title = EXCLUDED.job_title,
      rank_title = EXCLUDED.rank_title,
      avatar_url = EXCLUDED.avatar_url,
      is_approved = EXCLUDED.is_approved,
      synced_at = now();
  ELSE
    DELETE FROM public.profile_directory WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_profile_directory_row() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_profile_directory_row() FROM anon;
REVOKE ALL ON FUNCTION public.sync_profile_directory_row() FROM authenticated;

DROP TRIGGER IF EXISTS sync_profile_directory_row_trigger ON public.profiles;
CREATE TRIGGER sync_profile_directory_row_trigger
AFTER INSERT OR UPDATE OF full_name, department, position, job_title, rank_title, avatar_url, is_approved OR DELETE
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_directory_row();

INSERT INTO public.profile_directory (
  id, full_name, department, position, job_title, rank_title, avatar_url, is_approved, synced_at
)
SELECT
  id, full_name, department, position, job_title, rank_title, avatar_url, is_approved, now()
FROM public.profiles
WHERE is_approved IS TRUE
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  department = EXCLUDED.department,
  position = EXCLUDED.position,
  job_title = EXCLUDED.job_title,
  rank_title = EXCLUDED.rank_title,
  avatar_url = EXCLUDED.avatar_url,
  is_approved = EXCLUDED.is_approved,
  synced_at = now();

CREATE TABLE IF NOT EXISTS public.checked_in_employee_status (
  user_id uuid PRIMARY KEY,
  user_name text NOT NULL,
  check_in timestamptz,
  date date NOT NULL,
  status text NOT NULL,
  avatar_url text,
  department text,
  position text,
  synced_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checked_in_employee_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read checked in employee status" ON public.checked_in_employee_status;
CREATE POLICY "Authenticated users can read checked in employee status"
ON public.checked_in_employee_status
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND date = CURRENT_DATE);

CREATE OR REPLACE FUNCTION public.sync_checked_in_employee_status_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_row record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.checked_in_employee_status WHERE user_id = OLD.user_id;
    RETURN OLD;
  END IF;

  IF NEW.date = CURRENT_DATE AND NEW.status IN ('checked_in', 'present') THEN
    SELECT avatar_url, department, position
    INTO profile_row
    FROM public.profiles
    WHERE id = NEW.user_id;

    INSERT INTO public.checked_in_employee_status (
      user_id, user_name, check_in, date, status, avatar_url, department, position, synced_at
    )
    VALUES (
      NEW.user_id, NEW.user_name, NEW.check_in, NEW.date, NEW.status,
      profile_row.avatar_url, profile_row.department, profile_row.position, now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      user_name = EXCLUDED.user_name,
      check_in = EXCLUDED.check_in,
      date = EXCLUDED.date,
      status = EXCLUDED.status,
      avatar_url = EXCLUDED.avatar_url,
      department = EXCLUDED.department,
      position = EXCLUDED.position,
      synced_at = now();
  ELSE
    DELETE FROM public.checked_in_employee_status WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_checked_in_employee_profile_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.checked_in_employee_status
  SET
    avatar_url = NEW.avatar_url,
    department = NEW.department,
    position = NEW.position,
    synced_at = now()
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_checked_in_employee_status_row() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_checked_in_employee_status_row() FROM anon;
REVOKE ALL ON FUNCTION public.sync_checked_in_employee_status_row() FROM authenticated;
REVOKE ALL ON FUNCTION public.refresh_checked_in_employee_profile_row() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_checked_in_employee_profile_row() FROM anon;
REVOKE ALL ON FUNCTION public.refresh_checked_in_employee_profile_row() FROM authenticated;

DROP TRIGGER IF EXISTS sync_checked_in_employee_status_row_trigger ON public.attendance_records;
CREATE TRIGGER sync_checked_in_employee_status_row_trigger
AFTER INSERT OR UPDATE OF user_name, check_in, date, status OR DELETE
ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.sync_checked_in_employee_status_row();

DROP TRIGGER IF EXISTS refresh_checked_in_employee_profile_row_trigger ON public.profiles;
CREATE TRIGGER refresh_checked_in_employee_profile_row_trigger
AFTER UPDATE OF avatar_url, department, position
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.refresh_checked_in_employee_profile_row();

INSERT INTO public.checked_in_employee_status (
  user_id, user_name, check_in, date, status, avatar_url, department, position, synced_at
)
SELECT
  ar.user_id,
  ar.user_name,
  ar.check_in,
  ar.date,
  ar.status,
  p.avatar_url,
  p.department,
  p.position,
  now()
FROM public.attendance_records ar
LEFT JOIN public.profiles p ON p.id = ar.user_id
WHERE ar.date = CURRENT_DATE
  AND ar.status IN ('checked_in', 'present')
ON CONFLICT (user_id) DO UPDATE SET
  user_name = EXCLUDED.user_name,
  check_in = EXCLUDED.check_in,
  date = EXCLUDED.date,
  status = EXCLUDED.status,
  avatar_url = EXCLUDED.avatar_url,
  department = EXCLUDED.department,
  position = EXCLUDED.position,
  synced_at = now();

CREATE TABLE IF NOT EXISTS public.company_public_info (
  id uuid PRIMARY KEY,
  company_name text,
  ceo_name text,
  business_number text,
  address text,
  detail_address text,
  phone text,
  fax text,
  email text,
  website text,
  industry text,
  business_type text,
  established_date date,
  logo_url text,
  quote_notes text,
  quote_consultation text,
  quote_contact_phone text,
  quote_contact_email text,
  quote_contact_message text,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_quote_defaults (
  id uuid PRIMARY KEY,
  company_name text,
  ceo_name text,
  business_number text,
  address text,
  detail_address text,
  phone text,
  fax text,
  email text,
  website text,
  industry text,
  business_type text,
  logo_url text,
  quote_bank_info text,
  quote_notes text,
  quote_consultation text,
  quote_contact_phone text,
  quote_contact_email text,
  quote_contact_message text,
  synced_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_public_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_quote_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read company public info" ON public.company_public_info;
CREATE POLICY "Authenticated users can read company public info"
ON public.company_public_info
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can read company quote defaults" ON public.company_quote_defaults;
CREATE POLICY "Authenticated users can read company quote defaults"
ON public.company_quote_defaults
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.sync_company_safe_info_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.company_public_info WHERE id = OLD.id;
    DELETE FROM public.company_quote_defaults WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO public.company_public_info (
    id, company_name, ceo_name, business_number, address, detail_address, phone, fax, email, website,
    industry, business_type, established_date, logo_url, quote_notes, quote_consultation,
    quote_contact_phone, quote_contact_email, quote_contact_message, synced_at
  )
  VALUES (
    NEW.id, NEW.company_name, NEW.ceo_name, NEW.business_number, NEW.address, NEW.detail_address,
    NEW.phone, NEW.fax, NEW.email, NEW.website, NEW.industry, NEW.business_type, NEW.established_date,
    NEW.logo_url, NEW.quote_notes, NEW.quote_consultation, NEW.quote_contact_phone,
    NEW.quote_contact_email, NEW.quote_contact_message, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    ceo_name = EXCLUDED.ceo_name,
    business_number = EXCLUDED.business_number,
    address = EXCLUDED.address,
    detail_address = EXCLUDED.detail_address,
    phone = EXCLUDED.phone,
    fax = EXCLUDED.fax,
    email = EXCLUDED.email,
    website = EXCLUDED.website,
    industry = EXCLUDED.industry,
    business_type = EXCLUDED.business_type,
    established_date = EXCLUDED.established_date,
    logo_url = EXCLUDED.logo_url,
    quote_notes = EXCLUDED.quote_notes,
    quote_consultation = EXCLUDED.quote_consultation,
    quote_contact_phone = EXCLUDED.quote_contact_phone,
    quote_contact_email = EXCLUDED.quote_contact_email,
    quote_contact_message = EXCLUDED.quote_contact_message,
    synced_at = now();

  INSERT INTO public.company_quote_defaults (
    id, company_name, ceo_name, business_number, address, detail_address, phone, fax, email, website,
    industry, business_type, logo_url, quote_bank_info, quote_notes, quote_consultation,
    quote_contact_phone, quote_contact_email, quote_contact_message, synced_at
  )
  VALUES (
    NEW.id, NEW.company_name, NEW.ceo_name, NEW.business_number, NEW.address, NEW.detail_address,
    NEW.phone, NEW.fax, NEW.email, NEW.website, NEW.industry, NEW.business_type, NEW.logo_url,
    NEW.quote_bank_info, NEW.quote_notes, NEW.quote_consultation, NEW.quote_contact_phone,
    NEW.quote_contact_email, NEW.quote_contact_message, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    ceo_name = EXCLUDED.ceo_name,
    business_number = EXCLUDED.business_number,
    address = EXCLUDED.address,
    detail_address = EXCLUDED.detail_address,
    phone = EXCLUDED.phone,
    fax = EXCLUDED.fax,
    email = EXCLUDED.email,
    website = EXCLUDED.website,
    industry = EXCLUDED.industry,
    business_type = EXCLUDED.business_type,
    logo_url = EXCLUDED.logo_url,
    quote_bank_info = EXCLUDED.quote_bank_info,
    quote_notes = EXCLUDED.quote_notes,
    quote_consultation = EXCLUDED.quote_consultation,
    quote_contact_phone = EXCLUDED.quote_contact_phone,
    quote_contact_email = EXCLUDED.quote_contact_email,
    quote_contact_message = EXCLUDED.quote_contact_message,
    synced_at = now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_company_safe_info_row() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_company_safe_info_row() FROM anon;
REVOKE ALL ON FUNCTION public.sync_company_safe_info_row() FROM authenticated;

DROP TRIGGER IF EXISTS sync_company_safe_info_row_trigger ON public.company_info;
CREATE TRIGGER sync_company_safe_info_row_trigger
AFTER INSERT OR UPDATE OR DELETE
ON public.company_info
FOR EACH ROW
EXECUTE FUNCTION public.sync_company_safe_info_row();

INSERT INTO public.company_public_info (
  id, company_name, ceo_name, business_number, address, detail_address, phone, fax, email, website,
  industry, business_type, established_date, logo_url, quote_notes, quote_consultation,
  quote_contact_phone, quote_contact_email, quote_contact_message, synced_at
)
SELECT
  id, company_name, ceo_name, business_number, address, detail_address, phone, fax, email, website,
  industry, business_type, established_date, logo_url, quote_notes, quote_consultation,
  quote_contact_phone, quote_contact_email, quote_contact_message, now()
FROM public.company_info
ON CONFLICT (id) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  ceo_name = EXCLUDED.ceo_name,
  business_number = EXCLUDED.business_number,
  address = EXCLUDED.address,
  detail_address = EXCLUDED.detail_address,
  phone = EXCLUDED.phone,
  fax = EXCLUDED.fax,
  email = EXCLUDED.email,
  website = EXCLUDED.website,
  industry = EXCLUDED.industry,
  business_type = EXCLUDED.business_type,
  established_date = EXCLUDED.established_date,
  logo_url = EXCLUDED.logo_url,
  quote_notes = EXCLUDED.quote_notes,
  quote_consultation = EXCLUDED.quote_consultation,
  quote_contact_phone = EXCLUDED.quote_contact_phone,
  quote_contact_email = EXCLUDED.quote_contact_email,
  quote_contact_message = EXCLUDED.quote_contact_message,
  synced_at = now();

INSERT INTO public.company_quote_defaults (
  id, company_name, ceo_name, business_number, address, detail_address, phone, fax, email, website,
  industry, business_type, logo_url, quote_bank_info, quote_notes, quote_consultation,
  quote_contact_phone, quote_contact_email, quote_contact_message, synced_at
)
SELECT
  id, company_name, ceo_name, business_number, address, detail_address, phone, fax, email, website,
  industry, business_type, logo_url, quote_bank_info, quote_notes, quote_consultation,
  quote_contact_phone, quote_contact_email, quote_contact_message, now()
FROM public.company_info
ON CONFLICT (id) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  ceo_name = EXCLUDED.ceo_name,
  business_number = EXCLUDED.business_number,
  address = EXCLUDED.address,
  detail_address = EXCLUDED.detail_address,
  phone = EXCLUDED.phone,
  fax = EXCLUDED.fax,
  email = EXCLUDED.email,
  website = EXCLUDED.website,
  industry = EXCLUDED.industry,
  business_type = EXCLUDED.business_type,
  logo_url = EXCLUDED.logo_url,
  quote_bank_info = EXCLUDED.quote_bank_info,
  quote_notes = EXCLUDED.quote_notes,
  quote_consultation = EXCLUDED.quote_consultation,
  quote_contact_phone = EXCLUDED.quote_contact_phone,
  quote_contact_email = EXCLUDED.quote_contact_email,
  quote_contact_message = EXCLUDED.quote_contact_message,
  synced_at = now();

GRANT SELECT ON public.profile_directory TO authenticated;
GRANT SELECT ON public.checked_in_employee_status TO authenticated;
GRANT SELECT ON public.company_public_info TO authenticated;
GRANT SELECT ON public.company_quote_defaults TO authenticated;

-- ---------------------------------------------------------------------------
-- Sensitive base-table access: no broad staff PII access.
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read basic profiles" ON public.profiles;
DROP POLICY IF EXISTS "Moderators can view all profiles" ON public.profiles;

DROP POLICY IF EXISTS "Moderators can manage all dependents" ON public.tax_dependents;

-- ---------------------------------------------------------------------------
-- Storage scanner follow-up: explicit staff bucket read policies.
-- ---------------------------------------------------------------------------

UPDATE storage.buckets
SET public = false
WHERE id IN ('quote-pdfs', 'quote-attachments', 'recipient-documents');

DROP POLICY IF EXISTS "Admins can view all quote PDFs" ON storage.objects;
CREATE POLICY "Admins can view all quote PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'quote-pdfs' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Moderators can view all quote PDFs" ON storage.objects;
CREATE POLICY "Moderators can view all quote PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'quote-pdfs' AND public.has_role(auth.uid(), 'moderator'::app_role));

DROP POLICY IF EXISTS "Admins can view all recipient documents" ON storage.objects;
CREATE POLICY "Admins can view all recipient documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'recipient-documents' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Moderators can view all recipient documents" ON storage.objects;
CREATE POLICY "Moderators can view all recipient documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'recipient-documents' AND public.has_role(auth.uid(), 'moderator'::app_role));

NOTIFY pgrst, 'reload schema';
