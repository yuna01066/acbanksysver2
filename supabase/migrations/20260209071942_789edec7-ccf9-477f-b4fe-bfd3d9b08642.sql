
-- Drop the old restrictive delete policy that only allows pending
DROP POLICY IF EXISTS "Senders can delete their own pending meetings" ON public.peer_feedback;

-- Create a new policy that allows senders to delete their own meetings regardless of status
CREATE POLICY "Senders can delete their own meetings"
ON public.peer_feedback
FOR DELETE
USING (auth.uid() = sender_id AND feedback_type = 'meeting');

-- Also allow receiver to update meeting_status for accepted/rescheduled meetings (already covered by existing policy)
-- Allow sender to also update their own feedback for rescheduling
DROP POLICY IF EXISTS "Receiver can update read status" ON public.peer_feedback;

CREATE POLICY "Participants can update feedback"
ON public.peer_feedback
FOR UPDATE
USING (auth.uid() = receiver_id OR auth.uid() = sender_id);
