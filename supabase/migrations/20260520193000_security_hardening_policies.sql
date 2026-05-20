-- Security hardening for file ledgers, quote PDFs, pricing admin data, and Channel Talk leads.

-- document_files: file metadata should not be globally editable by every authenticated user.
DROP POLICY IF EXISTS "Authenticated users can view document files" ON public.document_files;
DROP POLICY IF EXISTS "Authenticated users can insert document files" ON public.document_files;
DROP POLICY IF EXISTS "Authenticated users can update document files" ON public.document_files;
DROP POLICY IF EXISTS "Authenticated users can delete document files" ON public.document_files;

CREATE POLICY "Users can view relevant document files"
ON public.document_files
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
  OR uploaded_by = auth.uid()
  OR (
    quote_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.saved_quotes sq
      WHERE sq.id = document_files.quote_id
        AND sq.user_id = auth.uid()
    )
  )
  OR (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = document_files.project_id
        AND p.user_id = auth.uid()
    )
  )
  OR (
    recipient_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.recipients r
      WHERE r.id = document_files.recipient_id
        AND r.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can create own document files"
ON public.document_files
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
  OR uploaded_by = auth.uid()
);

CREATE POLICY "Users can update own document files"
ON public.document_files
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
  OR uploaded_by = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
  OR uploaded_by = auth.uid()
);

CREATE POLICY "Users can delete own document files"
ON public.document_files
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
  OR uploaded_by = auth.uid()
);

-- quote-pdfs: move away from public bucket reads and broad authenticated mutation.
UPDATE storage.buckets
SET public = false
WHERE id = 'quote-pdfs';

DROP POLICY IF EXISTS "Public read access for quote PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload quote PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update quote PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete quote PDFs" ON storage.objects;

CREATE POLICY "Users can upload own quote PDFs"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'quote-pdfs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own quote PDFs"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'quote-pdfs'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  )
);

CREATE POLICY "Users can update own quote PDFs"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'quote-pdfs'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  )
)
WITH CHECK (
  bucket_id = 'quote-pdfs'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  )
);

CREATE POLICY "Users can delete own quote PDFs"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'quote-pdfs'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  )
);

-- Channel Talk leads: customer inquiry payloads should be manager-visible only.
DROP POLICY IF EXISTS "Authenticated users can view channel talk quote leads" ON public.channel_talk_quote_leads;
DROP POLICY IF EXISTS "Admins and moderators can view channel talk quote leads" ON public.channel_talk_quote_leads;

CREATE POLICY "Admins and moderators can view channel talk quote leads"
ON public.channel_talk_quote_leads
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);

-- Pricing/version data can be visible to staff, but write access should be admin/moderator only.
DROP POLICY IF EXISTS "Authenticated users can manage pricing versions" ON public.panel_pricing_versions;

CREATE POLICY "Admins and moderators can manage pricing versions"
ON public.panel_pricing_versions
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);

DROP POLICY IF EXISTS "Authenticated users can manage panel option surcharges" ON public.panel_option_surcharges;

CREATE POLICY "Admins and moderators can manage panel option surcharges"
ON public.panel_option_surcharges
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);
