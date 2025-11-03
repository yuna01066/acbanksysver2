-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Authenticated users can manage saved quotes" ON public.saved_quotes;

-- Create permissive policy for internal management system
CREATE POLICY "Anyone can manage saved quotes" 
ON public.saved_quotes 
FOR ALL 
USING (true)
WITH CHECK (true);