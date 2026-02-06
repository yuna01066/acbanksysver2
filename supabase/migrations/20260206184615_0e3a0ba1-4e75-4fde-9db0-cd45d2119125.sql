
-- Add business_document_url column to recipients table
ALTER TABLE public.recipients ADD COLUMN business_document_url text NULL;

-- Create storage bucket for recipient business documents
INSERT INTO storage.buckets (id, name, public) VALUES ('recipient-documents', 'recipient-documents', false);

-- RLS policies for recipient-documents bucket
CREATE POLICY "Users can upload their own recipient documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'recipient-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own recipient documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'recipient-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own recipient documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'recipient-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own recipient documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'recipient-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
