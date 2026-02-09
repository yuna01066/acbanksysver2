
-- Add attachments column to project_updates
ALTER TABLE public.project_updates
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Create storage bucket for project update attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-update-attachments', 'project-update-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload project update attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'project-update-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read project update attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-update-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own project update attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'project-update-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
