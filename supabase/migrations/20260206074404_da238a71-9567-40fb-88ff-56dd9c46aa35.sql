
-- Fix the overly permissive INSERT policy - restrict to service role only
DROP POLICY "Service role can insert sync events" ON public.pluuug_sync_events;

-- Edge function uses service role key which bypasses RLS, so we only need user insert policy
CREATE POLICY "Users can insert their own sync events"
ON public.pluuug_sync_events
FOR INSERT
WITH CHECK (auth.uid() = user_id);
