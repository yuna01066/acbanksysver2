-- Update slot_types RLS policy to allow anyone to manage
DROP POLICY IF EXISTS "Authenticated users can manage slot types" ON public.slot_types;

CREATE POLICY "Anyone can manage slot types" 
ON public.slot_types 
FOR ALL 
USING (true)
WITH CHECK (true);