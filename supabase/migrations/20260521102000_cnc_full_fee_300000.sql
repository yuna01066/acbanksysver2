-- CNC full-sheet cutting is a separate fixed labor fee from CNC heavy/general work.

INSERT INTO public.advanced_processing_settings (setting_key, setting_value, display_name, description, unit) VALUES
  ('cnc_full_fee', 300000, 'CNC 전체 재단 공임', 'CNC 전체 재단 정액 공임입니다. CNC 고강도 공임과 별도로 계산합니다.', '원')
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  is_active = true,
  updated_at = now();

UPDATE public.processing_options
SET base_cost = 300000,
    rate = NULL,
    pricing_method = 'panel_multiplier',
    multiplier = 1.3,
    updated_at = now()
WHERE option_id = 'cnc-full';
