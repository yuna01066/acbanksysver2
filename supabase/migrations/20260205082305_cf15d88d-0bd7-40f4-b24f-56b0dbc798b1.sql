-- Create public storage bucket for quote PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-pdfs', 'quote-pdfs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow anyone to read files from the bucket (public access)
CREATE POLICY "Public read access for quote PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'quote-pdfs');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload quote PDFs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'quote-pdfs' AND auth.role() = 'authenticated');

-- Allow authenticated users to update their uploaded files
CREATE POLICY "Authenticated users can update quote PDFs"
ON storage.objects FOR UPDATE
USING (bucket_id = 'quote-pdfs' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete their uploaded files
CREATE POLICY "Authenticated users can delete quote PDFs"
ON storage.objects FOR DELETE
USING (bucket_id = 'quote-pdfs' AND auth.role() = 'authenticated');