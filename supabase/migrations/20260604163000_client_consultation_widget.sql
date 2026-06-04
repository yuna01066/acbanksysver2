CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.client_consultation_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'imweb-acbankform',
  status TEXT NOT NULL DEFAULT 'new',
  customer_company TEXT,
  customer_name TEXT NOT NULL,
  customer_position TEXT,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  project_name TEXT,
  product_type TEXT,
  acrylic_type TEXT,
  color_name TEXT,
  color_code TEXT,
  thickness TEXT,
  sheet_size TEXT,
  quantity TEXT,
  dimensions TEXT,
  processing TEXT[] NOT NULL DEFAULT '{}',
  inquiry_body TEXT NOT NULL,
  desired_delivery_date DATE,
  delivery_address TEXT,
  privacy_consent BOOLEAN NOT NULL DEFAULT false,
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  converted_quote_id UUID REFERENCES public.saved_quotes(id) ON DELETE SET NULL,
  converted_quote_draft_id UUID REFERENCES public.quote_drafts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  missing_fields TEXT[] NOT NULL DEFAULT '{}',
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitter_ip_hash TEXT,
  user_agent TEXT,
  memo TEXT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_consultation_leads_status_check
    CHECK (status IN ('new', 'needs_review', 'converted', 'closed', 'on_hold')),
  CONSTRAINT client_consultation_leads_source_check
    CHECK (source IN ('imweb-acbankform', 'internal-test', 'manual')),
  CONSTRAINT client_consultation_leads_required_consent_check
    CHECK (privacy_consent IS TRUE)
);

CREATE TABLE IF NOT EXISTS public.client_consultation_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.client_consultation_leads(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'client-consultation-attachments',
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_consultation_files_bucket_check
    CHECK (storage_bucket = 'client-consultation-attachments')
);

CREATE INDEX IF NOT EXISTS idx_client_consultation_leads_status_created
  ON public.client_consultation_leads(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_consultation_leads_source_created
  ON public.client_consultation_leads(source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_consultation_leads_assigned_to
  ON public.client_consultation_leads(assigned_to)
  WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_consultation_leads_ip_recent
  ON public.client_consultation_leads(submitter_ip_hash, created_at DESC)
  WHERE submitter_ip_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_consultation_files_lead_id
  ON public.client_consultation_files(lead_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_consultation_files_storage_path
  ON public.client_consultation_files(storage_bucket, storage_path);

CREATE OR REPLACE FUNCTION public.touch_client_consultation_leads_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_consultation_leads_updated_at ON public.client_consultation_leads;
CREATE TRIGGER trg_client_consultation_leads_updated_at
BEFORE UPDATE ON public.client_consultation_leads
FOR EACH ROW
EXECUTE FUNCTION public.touch_client_consultation_leads_updated_at();

ALTER TABLE public.client_consultation_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_consultation_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and moderators can view client consultation leads" ON public.client_consultation_leads;
CREATE POLICY "Admins and moderators can view client consultation leads"
ON public.client_consultation_leads
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
  OR assigned_to = auth.uid()
);

DROP POLICY IF EXISTS "Admins and moderators can manage client consultation leads" ON public.client_consultation_leads;
CREATE POLICY "Admins and moderators can manage client consultation leads"
ON public.client_consultation_leads
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
  OR assigned_to = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
  OR assigned_to = auth.uid()
);

DROP POLICY IF EXISTS "Admins and assignees can view client consultation files" ON public.client_consultation_files;
CREATE POLICY "Admins and assignees can view client consultation files"
ON public.client_consultation_files
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.client_consultation_leads lead
    WHERE lead.id = client_consultation_files.lead_id
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'moderator'::public.app_role)
        OR public.has_role(auth.uid(), 'manager'::public.app_role)
        OR lead.assigned_to = auth.uid()
      )
  )
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-consultation-attachments',
  'client-consultation-attachments',
  false,
  20971520,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.ms-excel'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Admins can read client consultation attachment objects" ON storage.objects;
CREATE POLICY "Admins can read client consultation attachment objects"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'client-consultation-attachments'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'moderator'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.client_consultation_files file
      JOIN public.client_consultation_leads lead ON lead.id = file.lead_id
      WHERE file.storage_bucket = storage.objects.bucket_id
        AND file.storage_path = storage.objects.name
        AND lead.assigned_to = auth.uid()
    )
  )
);

GRANT SELECT, UPDATE ON public.client_consultation_leads TO authenticated;
GRANT SELECT ON public.client_consultation_files TO authenticated;
GRANT ALL ON public.client_consultation_leads TO service_role;
GRANT ALL ON public.client_consultation_files TO service_role;

COMMENT ON TABLE public.client_consultation_leads IS 'Public iframe consultation form submissions from ACBANK website before quote/project conversion.';
COMMENT ON TABLE public.client_consultation_files IS 'Private attachment metadata for client consultation leads.';
