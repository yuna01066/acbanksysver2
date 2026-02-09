-- Allow employees to update their own contracts (for signing/rejecting)
CREATE POLICY "Users can update their own contracts"
ON public.employment_contracts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);