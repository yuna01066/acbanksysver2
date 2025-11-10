-- Create storage bucket for quote attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quote-attachments',
  'quote-attachments',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/zip', 'application/x-zip-compressed', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);

-- Add attachments column to saved_quotes table
ALTER TABLE saved_quotes
ADD COLUMN attachments jsonb DEFAULT '[]'::jsonb;

-- RLS policies for quote-attachments bucket
CREATE POLICY "Users can upload their own quote attachments"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'quote-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own quote attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'quote-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all quote attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'quote-attachments'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Moderators can view all quote attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'quote-attachments'
  AND has_role(auth.uid(), 'moderator'::app_role)
);

CREATE POLICY "Users can delete their own quote attachments"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'quote-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can delete all quote attachments"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'quote-attachments'
  AND has_role(auth.uid(), 'admin'::app_role)
);