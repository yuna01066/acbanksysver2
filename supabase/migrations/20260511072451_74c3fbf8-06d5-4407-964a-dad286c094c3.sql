CREATE TABLE public.space_project_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  quote_number TEXT NOT NULL,
  quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until TEXT,
  -- Project info
  project_name TEXT NOT NULL,
  client_name TEXT,
  project_type TEXT,
  location TEXT,
  scheduled_date DATE,
  -- Space scale
  total_area NUMERIC,
  area_unit TEXT DEFAULT '㎡',
  floor_count INTEGER,
  zones JSONB DEFAULT '[]'::jsonb,
  -- Items & costs
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  cost_breakdown JSONB DEFAULT '{}'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  -- Recipient
  recipient_company TEXT,
  recipient_contact TEXT,
  recipient_phone TEXT,
  recipient_email TEXT,
  recipient_address TEXT,
  -- Notes & files
  memo TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.space_project_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own space quotes"
  ON public.space_project_quotes FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Users can insert own space quotes"
  ON public.space_project_quotes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own space quotes"
  ON public.space_project_quotes FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Users can delete own space quotes"
  ON public.space_project_quotes FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE TRIGGER update_space_project_quotes_updated_at
  BEFORE UPDATE ON public.space_project_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_space_project_quotes_user_id ON public.space_project_quotes(user_id);
CREATE INDEX idx_space_project_quotes_quote_date ON public.space_project_quotes(quote_date DESC);