-- Mirror deposition is a material surcharge, not a post-processing option.
-- Defaults are intentionally 0 until the current vendor sheet rates are confirmed in admin settings.

INSERT INTO public.advanced_processing_settings (setting_key, setting_value, display_name, description, unit) VALUES
  ('mirror_deposition_3x6', 0, '미러증착 3*6', '미러 계열 재질 선택 시 원판 1장 기준으로 더하는 미러증착 비용입니다.', '원/장'),
  ('mirror_deposition_4x8', 0, '미러증착 4*8', '미러 계열 재질 선택 시 원판 1장 기준으로 더하는 미러증착 비용입니다.', '원/장')
ON CONFLICT (setting_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  is_active = true,
  updated_at = now();
