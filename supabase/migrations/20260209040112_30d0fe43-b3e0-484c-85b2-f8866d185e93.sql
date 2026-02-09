
-- Labor law settings table for managing minimum wage, rules per year
CREATE TABLE public.labor_law_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL UNIQUE,
  minimum_hourly_wage NUMERIC NOT NULL DEFAULT 10320,
  weekly_work_hours NUMERIC NOT NULL DEFAULT 40,
  monthly_work_hours NUMERIC NOT NULL DEFAULT 209,
  weekly_holiday_hours NUMERIC NOT NULL DEFAULT 8,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.labor_law_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read (needed for calculations)
CREATE POLICY "Anyone can read labor law settings"
ON public.labor_law_settings FOR SELECT
USING (true);

-- Only admins can manage
CREATE POLICY "Admins can manage labor law settings"
ON public.labor_law_settings FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Insert 2026 defaults
INSERT INTO public.labor_law_settings (year, minimum_hourly_wage, weekly_work_hours, monthly_work_hours, weekly_holiday_hours, notes)
VALUES (2026, 10320, 40, 209, 8, '2026년 적용 최저임금 고시 기준');

-- Insert 2025 for reference
INSERT INTO public.labor_law_settings (year, minimum_hourly_wage, weekly_work_hours, monthly_work_hours, weekly_holiday_hours, notes)
VALUES (2025, 10030, 40, 209, 8, '2025년 적용 최저임금');

-- Trigger for updated_at
CREATE TRIGGER update_labor_law_settings_updated_at
BEFORE UPDATE ON public.labor_law_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
