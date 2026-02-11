
-- Add detailed leave grant settings to leave_policy_settings
ALTER TABLE public.leave_policy_settings 
  ADD COLUMN IF NOT EXISTS fiscal_year_month integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS monthly_leave_method text DEFAULT 'monthly_accrual',
  ADD COLUMN IF NOT EXISTS annual_leave_method text DEFAULT 'proportional_grant',
  ADD COLUMN IF NOT EXISTS decimal_rounding text DEFAULT 'round_up_day';

-- Create custom_leave_types table
CREATE TABLE public.custom_leave_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon_name TEXT DEFAULT 'Calendar',
  is_required BOOLEAN DEFAULT false,
  approval_required BOOLEAN DEFAULT false,
  reference_required BOOLEAN DEFAULT false,
  paid BOOLEAN DEFAULT true,
  max_days INTEGER,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_leave_types ENABLE ROW LEVEL SECURITY;

-- Everyone can read custom leave types
CREATE POLICY "Anyone authenticated can view custom leave types"
  ON public.custom_leave_types FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can manage
CREATE POLICY "Admins can manage custom leave types"
  ON public.custom_leave_types FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'moderator'))
  );

-- Insert default Korean labor law leave types
INSERT INTO public.custom_leave_types (name, icon_name, is_required, description, display_order) VALUES
  ('가족돌봄', 'Heart', true, NULL, 1),
  ('군소집훈련', 'Shield', true, NULL, 2),
  ('난임 치료', 'Baby', true, '난임 치료를 위해 사용하는 휴가입니다.', 3),
  ('배우자출산', 'Baby', true, NULL, 4),
  ('보건', 'Stethoscope', true, NULL, 5),
  ('보상', 'Award', true, NULL, 6),
  ('산전후 - 본인', 'Baby', true, NULL, 7),
  ('산전후 - 미숙아', 'Baby', true, NULL, 8),
  ('산전후 - 본인 (다태아)', 'Baby', true, NULL, 9),
  ('유산·사산', 'Heart', true, '유산 또는 사산으로 인한 신체적 · 정신적 건강 회복을 위해 사용하는 휴가입니다.', 10),
  ('유산·사산 (다태아)', 'Heart', true, '유산 또는 사산으로 인한 신체적 · 정신적 건강 회복을 위해 사용하는 휴가입니다.', 11),
  ('결혼 - 본인', 'Gem', false, NULL, 12),
  ('결혼 - 자녀', 'Gem', false, NULL, 13),
  ('리프레시', 'Coffee', false, NULL, 14),
  ('병가', 'Thermometer', false, NULL, 15),
  ('비상', 'AlertTriangle', false, NULL, 16),
  ('여름(바캉스)', 'Sun', false, NULL, 17),
  ('조의 - 부모/배우자/자녀', 'BookOpen', false, NULL, 18),
  ('조의 - 조부모/형제/자매', 'BookOpen', false, NULL, 19),
  ('포상', 'Star', false, NULL, 20);
