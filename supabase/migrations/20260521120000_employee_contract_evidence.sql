-- Employee electronic contract evidence, storage, and audit trail.

ALTER TABLE public.company_info
  ADD COLUMN IF NOT EXISTS company_seal_storage_path TEXT;

ALTER TABLE public.employment_contracts
  ADD COLUMN IF NOT EXISTS template_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS rendered_html TEXT,
  ADD COLUMN IF NOT EXISTS signed_rendered_html TEXT,
  ADD COLUMN IF NOT EXISTS signed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS signature_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS company_seal_included BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS company_seal_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS signed_pdf_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS signed_pdf_document_file_id UUID REFERENCES public.document_files(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

DROP POLICY IF EXISTS "Users can update their own contracts" ON public.employment_contracts;

CREATE TABLE IF NOT EXISTS public.contract_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('requested', 'opened', 'signed', 'rejected', 'downloaded')),
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_contract_events_contract_id ON public.contract_events(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_events_actor_id ON public.contract_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_contract_events_event_type ON public.contract_events(event_type);

CREATE POLICY "Admins can manage all contract events"
ON public.contract_events FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can manage all contract events"
ON public.contract_events FOR ALL
USING (has_role(auth.uid(), 'moderator'))
WITH CHECK (has_role(auth.uid(), 'moderator'));

CREATE POLICY "Users can view events for their own contracts"
ON public.contract_events FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.employment_contracts ec
    WHERE ec.id = contract_events.contract_id
      AND ec.user_id = auth.uid()
  )
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-contracts', 'employee-contracts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own contract files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'employee-contracts'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'moderator')
  )
);

CREATE POLICY "Users can view their own contract files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'employee-contracts'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR (storage.foldername(name))[1] = 'company'
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'moderator')
  )
);

CREATE POLICY "Users can update their own contract files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'employee-contracts'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'moderator')
  )
);

CREATE POLICY "Users can delete their own contract files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'employee-contracts'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'moderator')
  )
);
