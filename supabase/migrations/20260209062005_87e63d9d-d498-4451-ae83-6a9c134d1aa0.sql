-- Remove the public insert policy since inserts are handled via edge function with service role
DROP POLICY IF EXISTS "Anyone can create password reset requests" ON public.password_reset_requests;