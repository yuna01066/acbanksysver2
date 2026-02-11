
-- Add attachments column to team_messages
ALTER TABLE public.team_messages
  ADD COLUMN attachments jsonb DEFAULT '[]'::jsonb;

-- Create storage bucket for team chat attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-chat-attachments', 'team-chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for team chat attachments
CREATE POLICY "Authenticated users can upload team chat attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'team-chat-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view team chat attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'team-chat-attachments');

CREATE POLICY "Users can delete their own team chat attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'team-chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
