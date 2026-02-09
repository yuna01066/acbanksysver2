
-- Allow authenticated users to read basic profile info (for online employees display)
CREATE POLICY "Authenticated users can read basic profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to read today's attendance (for online status)
CREATE POLICY "Authenticated users can view today attendance"
ON public.attendance_records
FOR SELECT
TO authenticated
USING (date = CURRENT_DATE);
