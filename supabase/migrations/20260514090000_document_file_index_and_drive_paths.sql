-- Standard document index for quote-first file organization.
-- Files should live in Google Drive; Supabase stores searchable metadata and Drive IDs.

CREATE TABLE IF NOT EXISTS public.document_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('quote', 'project', 'recipient', 'internal', 'tax', 'employee', 'unclassified')),
  recipient_id UUID REFERENCES public.recipients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.saved_quotes(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_provider TEXT NOT NULL DEFAULT 'google_drive' CHECK (storage_provider IN ('google_drive', 'supabase_storage', 'gcs', 'external_url')),
  drive_file_id TEXT,
  drive_folder_id TEXT,
  drive_path TEXT,
  storage_bucket TEXT,
  storage_path TEXT,
  external_url TEXT,
  mime_type TEXT,
  file_size BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_document_files_owner ON public.document_files(owner_type, quote_id, project_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_document_files_quote_id ON public.document_files(quote_id);
CREATE INDEX IF NOT EXISTS idx_document_files_project_id ON public.document_files(project_id);
CREATE INDEX IF NOT EXISTS idx_document_files_recipient_id ON public.document_files(recipient_id);
CREATE INDEX IF NOT EXISTS idx_document_files_document_type ON public.document_files(document_type);

DROP TRIGGER IF EXISTS update_document_files_updated_at ON public.document_files;
CREATE TRIGGER update_document_files_updated_at
BEFORE UPDATE ON public.document_files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can view document files"
ON public.document_files FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert document files"
ON public.document_files FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update document files"
ON public.document_files FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete document files"
ON public.document_files FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

ALTER TABLE public.saved_quotes
  ADD COLUMN IF NOT EXISTS drive_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_folder_path TEXT,
  ADD COLUMN IF NOT EXISTS drive_pdf_file_id TEXT;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS drive_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_folder_path TEXT;

ALTER TABLE public.recipients
  ADD COLUMN IF NOT EXISTS drive_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_folder_path TEXT;

UPDATE public.saved_quotes
SET drive_folder_path = concat_ws(
  '/',
  'ACBANK_SYS',
  '01_발행견적서',
  to_char(COALESCE(quote_date, created_at, now()), 'YYYY'),
  to_char(COALESCE(quote_date, created_at, now()), 'MM'),
  concat_ws('_',
    COALESCE(NULLIF(quote_number, ''), '견적번호미정'),
    COALESCE(NULLIF(recipient_company, ''), '거래처미정'),
    COALESCE(NULLIF(project_name, ''), '프로젝트미정')
  )
)
WHERE drive_folder_path IS NULL;

UPDATE public.projects
SET drive_folder_path = concat_ws(
  '/',
  'ACBANK_SYS',
  '02_프로젝트',
  COALESCE(NULLIF(name, ''), '프로젝트미정')
)
WHERE drive_folder_path IS NULL;

UPDATE public.recipients
SET drive_folder_path = concat_ws(
  '/',
  'ACBANK_SYS',
  '03_거래처',
  COALESCE(NULLIF(company_name, ''), '거래처미정')
)
WHERE drive_folder_path IS NULL;

INSERT INTO public.document_files (
  owner_type,
  quote_id,
  project_id,
  document_type,
  file_name,
  storage_provider,
  storage_bucket,
  storage_path,
  mime_type,
  file_size,
  drive_path,
  metadata,
  uploaded_by,
  created_at
)
SELECT
  'quote',
  sq.id,
  sq.project_id,
  CASE WHEN att.value->>'type' = 'quote_pdf' THEN 'quote_pdf' ELSE 'customer_attachment' END,
  COALESCE(att.value->>'name', att.value->>'fileName', '첨부파일'),
  'supabase_storage',
  CASE WHEN att.value->>'type' = 'quote_pdf' THEN 'quote-pdfs' ELSE 'quote-attachments' END,
  att.value->>'path',
  NULLIF(att.value->>'type', 'quote_pdf'),
  NULLIF(att.value->>'size', '')::bigint,
  concat_ws(
    '/',
    sq.drive_folder_path,
    CASE WHEN att.value->>'type' = 'quote_pdf' THEN '00_견적서PDF' ELSE '01_고객첨부' END
  ),
  jsonb_build_object('source', 'saved_quotes.attachments', 'raw', att.value),
  sq.user_id,
  COALESCE(sq.created_at, now())
FROM public.saved_quotes sq
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(sq.attachments, '[]'::jsonb)) AS att(value)
WHERE att.value ? 'path'
  AND NOT EXISTS (
    SELECT 1 FROM public.document_files df
    WHERE df.quote_id = sq.id
      AND df.storage_path = att.value->>'path'
  );

INSERT INTO public.document_files (
  owner_type,
  project_id,
  document_type,
  file_name,
  storage_provider,
  storage_path,
  mime_type,
  file_size,
  drive_path,
  metadata,
  uploaded_by,
  created_at
)
SELECT
  'project',
  ipd.project_id,
  CASE WHEN ipd.document_type = 'quote' THEN 'purchase_quote' ELSE ipd.document_type END,
  ipd.file_name,
  CASE WHEN ipd.file_url LIKE 'http%' THEN 'external_url' ELSE 'gcs' END,
  ipd.file_url,
  ipd.mime_type,
  ipd.file_size,
  concat_ws(
    '/',
    p.drive_folder_path,
    '02_발주_매입',
    CASE WHEN ipd.document_type = 'quote' THEN '매입견적서' ELSE '영수증' END
  ),
  jsonb_build_object('source', 'internal_project_documents', 'internal_document_id', ipd.id),
  ipd.uploaded_by,
  COALESCE(ipd.created_at, now())
FROM public.internal_project_documents ipd
LEFT JOIN public.projects p ON p.id = ipd.project_id
WHERE ipd.file_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.document_files df
    WHERE df.metadata->>'internal_document_id' = ipd.id::text
  );
