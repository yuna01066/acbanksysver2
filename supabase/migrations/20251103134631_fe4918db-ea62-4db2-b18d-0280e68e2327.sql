-- Create processing_categories table
CREATE TABLE public.processing_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_key TEXT NOT NULL UNIQUE,
  category_name TEXT NOT NULL,
  icon_name TEXT NOT NULL DEFAULT 'Package',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.processing_categories ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can read processing categories" 
ON public.processing_categories 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can manage processing categories" 
ON public.processing_categories 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Insert default categories
INSERT INTO public.processing_categories (category_key, category_name, icon_name, display_order) VALUES
('raw', '원판 구매', 'Package', 1),
('simple', '단순 재단', 'Scissors', 2),
('complex', '복합 재단', 'Layers', 3),
('full', '전체 재단', 'Zap', 4),
('adhesion', '접착 가공', 'Droplet', 5),
('additional', '추가 옵션', 'Settings', 6);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_processing_categories_updated_at
BEFORE UPDATE ON public.processing_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();