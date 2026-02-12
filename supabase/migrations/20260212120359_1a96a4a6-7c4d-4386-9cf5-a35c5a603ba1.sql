-- Allow admins and moderators to delete leave requests
CREATE POLICY "Admins can delete all leave requests"
ON public.leave_requests
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can delete all leave requests"
ON public.leave_requests
FOR DELETE
USING (has_role(auth.uid(), 'moderator'::app_role));