-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Authenticated users can manage processing categories" ON public.processing_categories;

-- Create new permissive policy for managing categories
CREATE POLICY "Anyone can manage processing categories" 
ON public.processing_categories 
FOR ALL 
USING (true)
WITH CHECK (true);