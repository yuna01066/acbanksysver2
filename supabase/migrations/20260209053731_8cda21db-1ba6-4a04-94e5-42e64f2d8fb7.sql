
-- Create peer feedback/recognition table
CREATE TABLE public.peer_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('recognition', 'feedback', 'one_on_one')),
  message TEXT NOT NULL,
  emoji TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.peer_feedback ENABLE ROW LEVEL SECURITY;

-- Sender can create feedback
CREATE POLICY "Users can send feedback"
ON public.peer_feedback
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id);

-- Users can view feedback they sent or received
CREATE POLICY "Users can view own feedback"
ON public.peer_feedback
FOR SELECT
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Receiver can mark as read
CREATE POLICY "Receiver can update read status"
ON public.peer_feedback
FOR UPDATE
TO authenticated
USING (auth.uid() = receiver_id);

-- Admins can view all
CREATE POLICY "Admins can view all feedback"
ON public.peer_feedback
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
