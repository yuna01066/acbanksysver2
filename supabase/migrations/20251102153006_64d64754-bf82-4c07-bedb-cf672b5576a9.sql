-- Create slot_types table for dynamic slot management
CREATE TABLE IF NOT EXISTS public.slot_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  title TEXT,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.slot_types ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can read slot types" 
ON public.slot_types 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can manage slot types" 
ON public.slot_types 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Insert default slot types
INSERT INTO public.slot_types (slot_key, label, title, description, display_order, is_active) VALUES
('slot1', '선택 1', '가공 방식 선택', '기본 가공 방식을 선택하세요', 1, true),
('slot2', '선택 2', '추가 가공 옵션', '추가적인 가공 옵션을 선택하세요', 2, true),
('slot3', '선택 3', '접착 방식 선택', '접착 방식을 선택하세요', 3, true),
('slot4', '선택 4', '마감 옵션', '마감 옵션을 선택하세요', 4, true),
('additional', '추가 옵션', '추가 옵션', '추가적인 옵션을 선택하세요 (선택사항)', 5, true);

-- Create trigger for updated_at
CREATE TRIGGER update_slot_types_updated_at
BEFORE UPDATE ON public.slot_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.slot_types IS 'Dynamic slot type definitions for processing options';
COMMENT ON COLUMN public.slot_types.slot_key IS 'Unique key for slot type (e.g., slot1, slot2, custom1)';
COMMENT ON COLUMN public.slot_types.label IS 'Short label displayed in admin (e.g., 선택 1)';
COMMENT ON COLUMN public.slot_types.title IS 'Title displayed in calculator';
COMMENT ON COLUMN public.slot_types.description IS 'Description displayed in calculator';