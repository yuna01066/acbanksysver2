-- Ensure mirror quality color defaults are available for the calculator UI.
-- Pricing still uses CLEAR base panel price + finish/mirror surcharges in code.

INSERT INTO public.panel_masters (material, quality, name, description)
VALUES
  ('acrylic', 'acrylic-mirror', 'Mirror (미러)', 'MIRROR 기본 미러 색상판'),
  ('acrylic', 'astel-mirror', 'Astel Mirror (아스텔 미러)', 'ASTEL MIRROR 아스텔 미러 색상판'),
  ('acrylic', 'satin-mirror', 'Satin Mirror (사틴 미러)', 'SATIN MIRROR 사틴 미러 색상판')
ON CONFLICT (material, quality) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();

WITH mirror_defaults AS (
  SELECT *
  FROM (VALUES
    ('acrylic-mirror', 'MIRROR 미러', '#d8dde6', '미러 기본 색상', 10),
    ('astel-mirror', 'ASTEL-MIRROR 아스텔 미러', '#e4e7ec', '아스텔 미러 기본 색상', 20),
    ('satin-mirror', 'SATIN-MIRROR 사틴 미러', '#eef0f3', '사틴 미러 기본 색상', 30)
  ) AS defaults(quality, color_name, color_code, color_attribute_note, display_order)
)
INSERT INTO public.color_options (
  panel_master_id,
  color_name,
  color_code,
  is_active,
  display_order,
  is_producible,
  color_attribute_note,
  series_key
)
SELECT
  pm.id,
  md.color_name,
  md.color_code,
  true,
  md.display_order,
  true,
  md.color_attribute_note,
  'MIRROR'
FROM mirror_defaults md
JOIN public.panel_masters pm
  ON pm.quality::text = md.quality
WHERE NOT EXISTS (
  SELECT 1
  FROM public.color_options co
  WHERE co.panel_master_id = pm.id
    AND co.color_name = md.color_name
);
