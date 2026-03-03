-- Add issuer_id column to saved_quotes
ALTER TABLE public.saved_quotes ADD COLUMN issuer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_saved_quotes_issuer_id ON public.saved_quotes(issuer_id);

-- Add RLS policy: issuer can view their assigned quotes
CREATE POLICY "Issuers can view assigned quotes"
ON public.saved_quotes
FOR SELECT
TO public
USING (auth.uid() = issuer_id);

-- Add RLS policy: issuer can update their assigned quotes
CREATE POLICY "Issuers can update assigned quotes"
ON public.saved_quotes
FOR UPDATE
TO authenticated
USING (auth.uid() = issuer_id);