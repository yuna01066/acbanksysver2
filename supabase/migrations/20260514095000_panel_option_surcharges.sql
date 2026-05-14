CREATE TABLE IF NOT EXISTS public.panel_option_surcharges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quality_id TEXT NOT NULL DEFAULT 'global',
  surcharge_type TEXT NOT NULL CHECK (surcharge_type IN ('double_surface', 'satin_astel', 'bright_pigment')),
  size_name TEXT NOT NULL,
  cost NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (quality_id, surcharge_type, size_name)
);

ALTER TABLE public.panel_option_surcharges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read panel option surcharges"
  ON public.panel_option_surcharges
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage panel option surcharges"
  ON public.panel_option_surcharges
  FOR ALL
  USING (auth.uid() IS NOT NULL);

DROP TRIGGER IF EXISTS update_panel_option_surcharges_updated_at ON public.panel_option_surcharges;
CREATE TRIGGER update_panel_option_surcharges_updated_at
  BEFORE UPDATE ON public.panel_option_surcharges
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_panel_option_surcharges_lookup
  ON public.panel_option_surcharges(quality_id, surcharge_type, size_name);

INSERT INTO public.panel_option_surcharges (quality_id, surcharge_type, size_name, cost, notes)
VALUES
  ('global', 'double_surface', '3*6', 2000, '양단면 추가금'),
  ('global', 'double_surface', '대3*6', 2600, '양단면 추가금'),
  ('global', 'double_surface', '4*5', 2600, '양단면 추가금'),
  ('global', 'double_surface', '대4*5', 2600, '양단면 추가금'),
  ('global', 'double_surface', '1*2', 3200, '양단면 추가금'),
  ('global', 'double_surface', '4*6', 3200, '양단면 추가금'),
  ('global', 'double_surface', '4*8', 3600, '양단면 추가금'),
  ('global', 'double_surface', '4*10', 5000, '양단면 추가금'),
  ('global', 'double_surface', '5*5', 5000, '양단면 추가금'),
  ('global', 'double_surface', '5*6', 6000, '양단면 추가금'),
  ('global', 'double_surface', '5*8', 7000, '양단면 추가금'),
  ('global', 'double_surface', '소3*6', 2000, '양단면 추가금'),
  ('global', 'double_surface', '소1*2', 2900, '양단면 추가금'),
  ('global', 'satin_astel', '소3*6', 5000, '사틴/아스텔 추가금'),
  ('global', 'satin_astel', '대3*6', 5000, '사틴/아스텔 추가금'),
  ('global', 'satin_astel', '4*5', 5000, '사틴/아스텔 추가금'),
  ('global', 'satin_astel', '대4*5', 6000, '사틴/아스텔 추가금'),
  ('global', 'satin_astel', '소1*2', 6000, '사틴/아스텔 추가금'),
  ('global', 'satin_astel', '1*2', 7000, '사틴/아스텔 추가금'),
  ('global', 'satin_astel', '4*6', 7000, '사틴/아스텔 추가금'),
  ('global', 'satin_astel', '4*8', 10000, '사틴/아스텔 추가금'),
  ('global', 'satin_astel', '5*8', 20000, '사틴/아스텔 추가금'),
  ('global', 'bright_pigment', '3*6', 5000, '브라이트/진백/스리 조색비'),
  ('global', 'bright_pigment', '대3*6', 5000, '브라이트/진백/스리 조색비'),
  ('global', 'bright_pigment', '4*5', 5000, '브라이트/진백/스리 조색비'),
  ('global', 'bright_pigment', '대4*5', 5000, '브라이트/진백/스리 조색비'),
  ('global', 'bright_pigment', '1*2', 7500, '브라이트/진백/스리 조색비'),
  ('global', 'bright_pigment', '4*6', 7500, '브라이트/진백/스리 조색비'),
  ('global', 'bright_pigment', '4*8', 10000, '브라이트/진백/스리 조색비'),
  ('global', 'bright_pigment', '5*5', 11000, '브라이트/진백/스리 조색비'),
  ('global', 'bright_pigment', '5*6', 11500, '브라이트/진백/스리 조색비'),
  ('global', 'bright_pigment', '5*8', 12500, '브라이트/진백/스리 조색비')
ON CONFLICT (quality_id, surcharge_type, size_name)
DO UPDATE SET
  cost = EXCLUDED.cost,
  notes = EXCLUDED.notes,
  updated_at = now();
