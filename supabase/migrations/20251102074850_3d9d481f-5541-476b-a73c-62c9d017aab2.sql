-- Create adhesive_costs table for double-sided tape costs
CREATE TABLE IF NOT EXISTS public.adhesive_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  panel_master_id UUID NOT NULL REFERENCES public.panel_masters(id) ON DELETE CASCADE,
  thickness TEXT NOT NULL,
  cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(panel_master_id, thickness)
);

-- Enable RLS
ALTER TABLE public.adhesive_costs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Anyone can read adhesive costs"
  ON public.adhesive_costs
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage adhesive costs"
  ON public.adhesive_costs
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_adhesive_costs_updated_at
  BEFORE UPDATE ON public.adhesive_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_adhesive_costs_panel_master ON public.adhesive_costs(panel_master_id);
CREATE INDEX idx_adhesive_costs_is_active ON public.adhesive_costs(panel_master_id, thickness);