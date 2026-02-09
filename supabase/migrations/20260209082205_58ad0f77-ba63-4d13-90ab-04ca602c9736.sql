
-- Allow admins to manage all recipients
CREATE POLICY "Admins can manage all recipients"
ON public.recipients
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow moderators to manage all recipients
CREATE POLICY "Moderators can manage all recipients"
ON public.recipients
FOR ALL
USING (has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

-- Allow all authenticated users to read all recipients (for team sharing)
CREATE POLICY "Authenticated users can view all recipients"
ON public.recipients
FOR SELECT
USING (auth.uid() IS NOT NULL);
