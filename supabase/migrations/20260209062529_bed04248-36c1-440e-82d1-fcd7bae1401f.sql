-- Create team messages table for real-time team chat
CREATE TABLE public.team_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  avatar_url TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read messages
CREATE POLICY "Authenticated users can read team messages"
  ON public.team_messages FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Users can insert their own messages
CREATE POLICY "Users can insert their own messages"
  ON public.team_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own messages
CREATE POLICY "Users can delete their own messages"
  ON public.team_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can delete any message
CREATE POLICY "Admins can delete any message"
  ON public.team_messages FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_messages;