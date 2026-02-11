
-- Add new columns to material_orders for enhanced order card
ALTER TABLE public.material_orders ADD COLUMN IF NOT EXISTS color_code text;
ALTER TABLE public.material_orders ADD COLUMN IF NOT EXISTS surface_type text;
ALTER TABLE public.material_orders ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.saved_quotes(id) ON DELETE SET NULL;
