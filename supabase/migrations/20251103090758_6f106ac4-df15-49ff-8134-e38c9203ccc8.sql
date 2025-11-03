-- Create table for storing published quotes
CREATE TABLE public.saved_quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number text NOT NULL,
  quote_date timestamp with time zone NOT NULL DEFAULT now(),
  recipient_name text,
  recipient_company text,
  recipient_phone text,
  recipient_email text,
  recipient_address text,
  recipient_memo text,
  items jsonb NOT NULL,
  subtotal numeric NOT NULL,
  tax numeric NOT NULL,
  total numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_quotes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can read saved quotes" 
ON public.saved_quotes 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can manage saved quotes" 
ON public.saved_quotes 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_saved_quotes_updated_at
BEFORE UPDATE ON public.saved_quotes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for searching
CREATE INDEX idx_saved_quotes_quote_number ON public.saved_quotes(quote_number);
CREATE INDEX idx_saved_quotes_date ON public.saved_quotes(quote_date);
CREATE INDEX idx_saved_quotes_recipient ON public.saved_quotes(recipient_name, recipient_company);