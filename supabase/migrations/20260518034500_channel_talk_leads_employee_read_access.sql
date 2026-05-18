DROP POLICY IF EXISTS "Admins and moderators can view channel talk quote leads"
ON public.channel_talk_quote_leads;

CREATE POLICY "Authenticated users can view channel talk quote leads"
ON public.channel_talk_quote_leads
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
