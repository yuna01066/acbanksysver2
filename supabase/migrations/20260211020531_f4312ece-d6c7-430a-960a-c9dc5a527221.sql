
-- Allow admins to insert attendance records for any user
CREATE POLICY "Admins can insert all attendance"
ON public.attendance_records
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow moderators to insert attendance records for any user
CREATE POLICY "Moderators can insert all attendance"
ON public.attendance_records
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

-- Allow moderators to update all attendance
CREATE POLICY "Moderators can update all attendance"
ON public.attendance_records
FOR UPDATE
USING (has_role(auth.uid(), 'moderator'::app_role));
