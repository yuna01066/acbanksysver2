
-- Create direct messages table for 1:1 conversations
CREATE TABLE public.direct_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Users can send messages (insert)
CREATE POLICY "Users can send direct messages"
  ON public.direct_messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Users can read their own conversations
CREATE POLICY "Users can view their own direct messages"
  ON public.direct_messages
  FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can update read status on received messages
CREATE POLICY "Users can mark messages as read"
  ON public.direct_messages
  FOR UPDATE
  USING (auth.uid() = receiver_id);

-- Users can delete their own sent messages
CREATE POLICY "Users can delete their own messages"
  ON public.direct_messages
  FOR DELETE
  USING (auth.uid() = sender_id);

-- Admins can view all
CREATE POLICY "Admins can view all direct messages"
  ON public.direct_messages
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- Index for conversation lookups
CREATE INDEX idx_direct_messages_participants ON public.direct_messages (sender_id, receiver_id, created_at DESC);
CREATE INDEX idx_direct_messages_receiver ON public.direct_messages (receiver_id, is_read);
