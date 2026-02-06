
-- Allow authenticated users to insert notifications for quote stage changes
-- (when they change a quote stage, they need to notify the quote owner)
CREATE POLICY "Authenticated users can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
