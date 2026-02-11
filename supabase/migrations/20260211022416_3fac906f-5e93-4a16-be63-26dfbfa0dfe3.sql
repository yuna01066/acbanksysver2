-- Allow admins to insert leave requests for any user
CREATE POLICY "Admins can insert all leave requests"
ON public.leave_requests
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow moderators to insert leave requests for any user
CREATE POLICY "Moderators can insert all leave requests"
ON public.leave_requests
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));