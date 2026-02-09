
-- Add avatar_url column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create storage bucket for profile avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view avatars (public bucket)
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Allow admins to upload avatars for any user
CREATE POLICY "Admins can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update avatars
CREATE POLICY "Admins can update avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete avatars
CREATE POLICY "Admins can delete avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Allow users to upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
