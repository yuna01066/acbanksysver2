CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.branding_intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'branding-intake',
  status TEXT NOT NULL DEFAULT 'new',
  customer_company TEXT,
  customer_name TEXT NOT NULL,
  customer_position TEXT,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  project_name TEXT,
  industry TEXT,
  homepage_url TEXT,
  reference_note TEXT,
  inquiry_body TEXT,
  package_id TEXT NOT NULL,
  package_label TEXT NOT NULL,
  lead_time_id TEXT NOT NULL,
  lead_time_label TEXT NOT NULL,
  optimization_tier_id TEXT NOT NULL DEFAULT 'none',
  optimization_tier_label TEXT NOT NULL DEFAULT '선택 안 함',
  selected_addons JSONB NOT NULL DEFAULT '[]'::jsonb,
  design_subtotal NUMERIC NOT NULL DEFAULT 0,
  lead_time_surcharge NUMERIC NOT NULL DEFAULT 0,
  pm_cost NUMERIC NOT NULL DEFAULT 0,
  internal_total NUMERIC NOT NULL DEFAULT 0,
  separate_review_items TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  pricing_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  customer_estimate_text TEXT,
  customer_message TEXT NOT NULL,
  internal_breakdown TEXT NOT NULL,
  privacy_consent BOOLEAN NOT NULL DEFAULT false,
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  submission_token TEXT,
  submitter_ip_hash TEXT,
  user_agent TEXT,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  memo TEXT,
  closed_at TIMESTAMPTZ,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT branding_intakes_status_check
    CHECK (status IN ('new', 'reviewing', 'responded', 'project_candidate', 'closed')),
  CONSTRAINT branding_intakes_source_check
    CHECK (source IN ('branding-intake', 'internal-test', 'manual')),
  CONSTRAINT branding_intakes_required_consent_check
    CHECK (privacy_consent IS TRUE),
  CONSTRAINT branding_intakes_amount_check
    CHECK (design_subtotal >= 0 AND lead_time_surcharge >= 0 AND pm_cost >= 0 AND internal_total >= 0)
);

CREATE TABLE IF NOT EXISTS public.branding_intake_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id UUID NOT NULL REFERENCES public.branding_intakes(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'branding-intake-attachments',
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT branding_intake_files_bucket_check
    CHECK (storage_bucket = 'branding-intake-attachments')
);

CREATE TABLE IF NOT EXISTS public.branding_intake_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id UUID NOT NULL REFERENCES public.branding_intakes(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branding_intakes_status_created
  ON public.branding_intakes(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_branding_intakes_source_created
  ON public.branding_intakes(source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_branding_intakes_assigned_to
  ON public.branding_intakes(assigned_to)
  WHERE assigned_to IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_branding_intakes_submission_token
  ON public.branding_intakes(source, submission_token)
  WHERE submission_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_branding_intake_files_intake_id
  ON public.branding_intake_files(intake_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_branding_intake_files_storage_path
  ON public.branding_intake_files(storage_bucket, storage_path);

CREATE INDEX IF NOT EXISTS idx_branding_intake_events_intake_id_created
  ON public.branding_intake_events(intake_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_branding_intakes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_branding_intakes_updated_at ON public.branding_intakes;
CREATE TRIGGER trg_branding_intakes_updated_at
BEFORE UPDATE ON public.branding_intakes
FOR EACH ROW
EXECUTE FUNCTION public.touch_branding_intakes_updated_at();

ALTER TABLE public.branding_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding_intake_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding_intake_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved staff can view branding intakes" ON public.branding_intakes;
CREATE POLICY "Approved staff can view branding intakes"
ON public.branding_intakes
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_approved IS TRUE
  )
);

DROP POLICY IF EXISTS "Approved staff can update branding intakes" ON public.branding_intakes;
CREATE POLICY "Approved staff can update branding intakes"
ON public.branding_intakes
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_approved IS TRUE
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_approved IS TRUE
  )
);

DROP POLICY IF EXISTS "Approved staff can view branding files" ON public.branding_intake_files;
CREATE POLICY "Approved staff can view branding files"
ON public.branding_intake_files
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_approved IS TRUE
  )
);

DROP POLICY IF EXISTS "Approved staff can view branding events" ON public.branding_intake_events;
CREATE POLICY "Approved staff can view branding events"
ON public.branding_intake_events
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_approved IS TRUE
  )
);

DROP POLICY IF EXISTS "Approved staff can insert branding events" ON public.branding_intake_events;
CREATE POLICY "Approved staff can insert branding events"
ON public.branding_intake_events
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_approved IS TRUE
  )
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'branding-intake-attachments',
  'branding-intake-attachments',
  false,
  20971520,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.ms-excel',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Approved staff can read branding attachment objects" ON storage.objects;
CREATE POLICY "Approved staff can read branding attachment objects"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'branding-intake-attachments'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_approved IS TRUE
  )
);

GRANT SELECT, UPDATE ON public.branding_intakes TO authenticated;
GRANT SELECT ON public.branding_intake_files TO authenticated;
GRANT SELECT, INSERT ON public.branding_intake_events TO authenticated;
GRANT ALL ON public.branding_intakes TO service_role;
GRANT ALL ON public.branding_intake_files TO service_role;
GRANT ALL ON public.branding_intake_events TO service_role;

COMMENT ON TABLE public.branding_intakes IS 'Standalone branding intake submissions and pricing snapshots, isolated from acrylic consultation and quote systems.';
COMMENT ON TABLE public.branding_intake_files IS 'Private attachment metadata for standalone branding intakes.';
COMMENT ON TABLE public.branding_intake_events IS 'Activity history for standalone branding intake handling.';
