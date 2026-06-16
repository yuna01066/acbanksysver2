CREATE POLICY "Block direct client inserts on password reset requests"
ON public.password_reset_requests
FOR INSERT
TO authenticated, anon
WITH CHECK (false);