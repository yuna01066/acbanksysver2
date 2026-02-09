
-- Company info table
CREATE TABLE public.company_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT '',
  ceo_name text DEFAULT '',
  business_number text DEFAULT '',
  address text DEFAULT '',
  detail_address text DEFAULT '',
  phone text DEFAULT '',
  fax text DEFAULT '',
  email text DEFAULT '',
  website text DEFAULT '',
  industry text DEFAULT '',
  business_type text DEFAULT '',
  established_date date DEFAULT NULL,
  logo_url text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read company info" ON public.company_info FOR SELECT USING (true);
CREATE POLICY "Admins can manage company info" ON public.company_info FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderators can manage company info" ON public.company_info FOR ALL USING (has_role(auth.uid(), 'moderator')) WITH CHECK (has_role(auth.uid(), 'moderator'));

-- Company holidays table
CREATE TABLE public.company_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_recurring boolean NOT NULL DEFAULT false,
  holiday_type text NOT NULL DEFAULT 'custom',
  substitute_holiday boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read company holidays" ON public.company_holidays FOR SELECT USING (true);
CREATE POLICY "Admins can manage company holidays" ON public.company_holidays FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderators can manage company holidays" ON public.company_holidays FOR ALL USING (has_role(auth.uid(), 'moderator')) WITH CHECK (has_role(auth.uid(), 'moderator'));

-- Seed 2026 Korean public holidays
INSERT INTO public.company_holidays (name, start_date, end_date, is_recurring, holiday_type, substitute_holiday) VALUES
('신정', '2026-01-01', '2026-01-01', true, 'public', false),
('설날', '2026-02-16', '2026-02-18', true, 'public', true),
('3·1절', '2026-03-01', '2026-03-01', true, 'public', true),
('노동절', '2026-05-01', '2026-05-01', false, 'public', false),
('어린이날', '2026-05-05', '2026-05-05', true, 'public', true),
('부처님 오신 날', '2026-05-24', '2026-05-24', true, 'public', true),
('현충일', '2026-06-06', '2026-06-06', true, 'public', false),
('제헌절', '2026-07-17', '2026-07-17', true, 'public', false),
('광복절', '2026-08-15', '2026-08-15', true, 'public', true),
('추석', '2026-09-24', '2026-09-26', true, 'public', true),
('개천절', '2026-10-03', '2026-10-03', true, 'public', true),
('한글날', '2026-10-09', '2026-10-09', true, 'public', true),
('크리스마스', '2026-12-25', '2026-12-25', true, 'public', true);
