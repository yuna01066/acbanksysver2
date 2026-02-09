-- Allow senders to delete their own pending meeting requests
CREATE POLICY "Senders can delete their own pending meetings"
ON public.peer_feedback
FOR DELETE
USING (auth.uid() = sender_id AND feedback_type = 'meeting' AND meeting_status = 'pending');