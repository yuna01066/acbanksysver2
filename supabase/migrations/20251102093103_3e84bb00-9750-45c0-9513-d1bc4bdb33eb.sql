-- Create advanced processing settings table
CREATE TABLE IF NOT EXISTS public.advanced_processing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value NUMERIC NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.advanced_processing_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can read advanced processing settings" 
ON public.advanced_processing_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can manage advanced processing settings" 
ON public.advanced_processing_settings 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_advanced_processing_settings_updated_at
BEFORE UPDATE ON public.advanced_processing_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default values
INSERT INTO public.advanced_processing_settings (setting_key, setting_value, display_name, description, unit) VALUES
  ('bevel_cost_per_m', 3000, '45° 베벨 단가', '베벨 가공 미터당 단가', '원/m'),
  ('laser_hole_cost', 500, '레이저 타공 단가', '레이저 타공 개당 단가', '원/개'),
  ('corner_90_cost', 4000, '90° 코너 마감비', '90도 코너 마감 개당 단가', '원/개'),
  ('bond_setup_fee', 50000, '본드 세팅비', '상세 본드 계산 시 초기 세팅비', '원'),
  ('bond_rate_per_m', 15000, '본드 미터당 단가', '접착선 미터당 본드 단가', '원/m'),
  ('volume_discount_factor', 0.15, '수량 할인 계수', '수량 증가에 따른 할인 계수 k (Q(n) = 1/(1+k*ln(n)))', '-')
ON CONFLICT (setting_key) DO NOTHING;