DROP POLICY IF EXISTS "Anyone can insert error logs" ON public.client_error_logs;

CREATE POLICY "Anon can insert anonymous error logs"
ON public.client_error_logs
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

CREATE POLICY "Authenticated can insert own error logs"
ON public.client_error_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());