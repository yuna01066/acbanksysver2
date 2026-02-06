
-- Add project_stage column to saved_quotes
ALTER TABLE public.saved_quotes 
ADD COLUMN project_stage text NOT NULL DEFAULT 'quote_issued';
