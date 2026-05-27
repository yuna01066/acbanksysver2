-- Seed selectable white opacity reference colors for ACBANK quote calculator.
-- Additive/idempotent. Existing issued quote amounts are not recalculated.

ALTER TABLE public.color_options
  ADD COLUMN IF NOT EXISTS series_key TEXT,
  ADD COLUMN IF NOT EXISTS pantone TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS is_producible BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_bright_pigment BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unavailable_reason TEXT,
  ADD COLUMN IF NOT EXISTS color_attribute_note TEXT,
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_color_options_attributes
  ON public.color_options USING GIN (attributes);

WITH seed (
  quality,
  color_name,
  color_code,
  series_key,
  material_series,
  finish_type,
  texture_type,
  visual_opacity_percent,
  white_pigment_percent,
  transparency_percent,
  equivalent_to,
  note,
  display_order
) AS (
  VALUES
    ('glossy-color', 'AC-C001', '#F8FAFC', 'CLEAR_WHITE', 'clear_glossy', 'glossy', 'none', 0, 0, 100, NULL, '투명 유광 기준', 1),
    ('glossy-color', 'AC-C002', '#F3F4F6', 'CLEAR_WHITE', 'clear_glossy', 'glossy', 'none', 20, 20, 80, NULL, '유광 백색도 20 기준', 2),
    ('glossy-color', 'AC-C003', '#E5E7EB', 'CLEAR_WHITE', 'clear_glossy', 'glossy', 'none', 40, 40, 60, NULL, '유광 백색도 40 기준', 3),
    ('glossy-color', 'AC-C004', '#D1D5DB', 'CLEAR_WHITE', 'clear_glossy', 'glossy', 'none', 60, 60, 40, NULL, '유광 백색도 60 기준', 4),
    ('glossy-color', 'AC-C005', '#F1F5F9', 'CLEAR_WHITE', 'clear_glossy', 'glossy', 'none', 80, 80, 20, NULL, '유광 백색도 80 기준', 5),
    ('glossy-color', 'AC-C006', '#FFFFFF', 'CLEAR_WHITE', 'clear_glossy', 'glossy', 'none', 100, 100, 0, NULL, '유광 백색 불투명 기준', 6),
    ('satin-color', 'AC-B001', '#F8FAFC', 'SATIN_WHITE', 'satin_texture', 'satin_matte', 'satin_matte', 10, 0, 100, 'AC-ST', '투명 아크릴에 무광 사틴 텍스처만 있는 기준. AC-ST 사틴 투명 계열과 동일하게 취급', 1),
    ('satin-color', 'AC-B002', '#F3F4F6', 'SATIN_WHITE', 'satin_texture', 'satin_matte', 'satin_matte', 20, 20, 80, NULL, '사틴 텍스처 백색도 20 기준', 2),
    ('satin-color', 'AC-B003', '#E5E7EB', 'SATIN_WHITE', 'satin_texture', 'satin_matte', 'satin_matte', 40, 40, 60, NULL, '사틴 텍스처 백색도 40 기준', 3),
    ('satin-color', 'AC-B004', '#D1D5DB', 'SATIN_WHITE', 'satin_texture', 'satin_matte', 'satin_matte', 60, 60, 40, NULL, '사틴 텍스처 백색도 60 기준. Bright 시리즈의 스리/진백 기준 베이스', 4),
    ('satin-color', 'AC-B005', '#F1F5F9', 'SATIN_WHITE', 'satin_texture', 'satin_matte', 'satin_matte', 80, 80, 20, NULL, '사틴 텍스처 백색도 80 기준', 5),
    ('satin-color', 'AC-B006', '#FFFFFF', 'SATIN_WHITE', 'satin_texture', 'satin_matte', 'satin_matte', 100, 100, 0, NULL, '사틴 텍스처 백색 불투명 기준', 6),
    ('astel-color', 'AC-AS001', '#F8FAFC', 'ASTEL_WHITE', 'astel_texture', 'astel', 'astel', 0, 0, 100, NULL, '아스텔 투명 기준', 1),
    ('astel-color', 'AC-AS002', '#F3F4F6', 'ASTEL_WHITE', 'astel_texture', 'astel', 'astel', 20, 20, 80, NULL, '아스텔 백색도 20 기준', 2),
    ('astel-color', 'AC-AS003', '#E5E7EB', 'ASTEL_WHITE', 'astel_texture', 'astel', 'astel', 40, 40, 60, NULL, '아스텔 백색도 40 기준', 3),
    ('astel-color', 'AC-AS004', '#D1D5DB', 'ASTEL_WHITE', 'astel_texture', 'astel', 'astel', 60, 60, 40, NULL, '아스텔 백색도 60 기준', 4),
    ('astel-color', 'AC-AS005', '#F1F5F9', 'ASTEL_WHITE', 'astel_texture', 'astel', 'astel', 80, 80, 20, NULL, '아스텔 백색도 80 기준', 5),
    ('astel-color', 'AC-AS006', '#FFFFFF', 'ASTEL_WHITE', 'astel_texture', 'astel', 'astel', 100, 100, 0, NULL, '아스텔 백색 불투명 기준', 6)
)
INSERT INTO public.color_options (
  panel_master_id,
  color_name,
  color_code,
  is_active,
  display_order,
  is_producible,
  is_bright_pigment,
  unavailable_reason,
  color_attribute_note,
  series_key,
  pantone,
  source_url,
  attributes
)
SELECT
  pm.id,
  seed.color_name,
  seed.color_code,
  true,
  seed.display_order,
  true,
  false,
  null,
  seed.note,
  seed.series_key,
  concat('WHITE ', seed.visual_opacity_percent, '%'),
  null,
  jsonb_strip_nulls(jsonb_build_object(
    'schema_version', 'color-attributes-v1-260527',
    'color_family', 'white_opacity_reference',
    'material_series', seed.material_series,
    'finish_type', seed.finish_type,
    'texture_type', seed.texture_type,
    'visual_opacity_percent', seed.visual_opacity_percent,
    'white_pigment_percent', seed.white_pigment_percent,
    'transparency_percent', seed.transparency_percent,
    'is_white_opacity_reference', true,
    'equivalent_to', seed.equivalent_to,
    'reference_note', seed.note
  ))
FROM seed
JOIN public.panel_masters pm
  ON pm.material::text = 'acrylic'
 AND pm.quality::text = seed.quality
WHERE NOT EXISTS (
  SELECT 1
  FROM public.color_options existing
  WHERE existing.panel_master_id = pm.id
    AND existing.color_name = seed.color_name
);

WITH seed (
  quality,
  color_name,
  color_code,
  series_key,
  material_series,
  finish_type,
  texture_type,
  visual_opacity_percent,
  white_pigment_percent,
  transparency_percent,
  equivalent_to,
  note
) AS (
  VALUES
    ('glossy-color', 'AC-C001', '#F8FAFC', 'CLEAR_WHITE', 'clear_glossy', 'glossy', 'none', 0, 0, 100, NULL, '투명 유광 기준'),
    ('glossy-color', 'AC-C002', '#F3F4F6', 'CLEAR_WHITE', 'clear_glossy', 'glossy', 'none', 20, 20, 80, NULL, '유광 백색도 20 기준'),
    ('glossy-color', 'AC-C003', '#E5E7EB', 'CLEAR_WHITE', 'clear_glossy', 'glossy', 'none', 40, 40, 60, NULL, '유광 백색도 40 기준'),
    ('glossy-color', 'AC-C004', '#D1D5DB', 'CLEAR_WHITE', 'clear_glossy', 'glossy', 'none', 60, 60, 40, NULL, '유광 백색도 60 기준'),
    ('glossy-color', 'AC-C005', '#F1F5F9', 'CLEAR_WHITE', 'clear_glossy', 'glossy', 'none', 80, 80, 20, NULL, '유광 백색도 80 기준'),
    ('glossy-color', 'AC-C006', '#FFFFFF', 'CLEAR_WHITE', 'clear_glossy', 'glossy', 'none', 100, 100, 0, NULL, '유광 백색 불투명 기준'),
    ('satin-color', 'AC-B001', '#F8FAFC', 'SATIN_WHITE', 'satin_texture', 'satin_matte', 'satin_matte', 10, 0, 100, 'AC-ST', '투명 아크릴에 무광 사틴 텍스처만 있는 기준. AC-ST 사틴 투명 계열과 동일하게 취급'),
    ('satin-color', 'AC-B002', '#F3F4F6', 'SATIN_WHITE', 'satin_texture', 'satin_matte', 'satin_matte', 20, 20, 80, NULL, '사틴 텍스처 백색도 20 기준'),
    ('satin-color', 'AC-B003', '#E5E7EB', 'SATIN_WHITE', 'satin_texture', 'satin_matte', 'satin_matte', 40, 40, 60, NULL, '사틴 텍스처 백색도 40 기준'),
    ('satin-color', 'AC-B004', '#D1D5DB', 'SATIN_WHITE', 'satin_texture', 'satin_matte', 'satin_matte', 60, 60, 40, NULL, '사틴 텍스처 백색도 60 기준. Bright 시리즈의 스리/진백 기준 베이스'),
    ('satin-color', 'AC-B005', '#F1F5F9', 'SATIN_WHITE', 'satin_texture', 'satin_matte', 'satin_matte', 80, 80, 20, NULL, '사틴 텍스처 백색도 80 기준'),
    ('satin-color', 'AC-B006', '#FFFFFF', 'SATIN_WHITE', 'satin_texture', 'satin_matte', 'satin_matte', 100, 100, 0, NULL, '사틴 텍스처 백색 불투명 기준'),
    ('astel-color', 'AC-AS001', '#F8FAFC', 'ASTEL_WHITE', 'astel_texture', 'astel', 'astel', 0, 0, 100, NULL, '아스텔 투명 기준'),
    ('astel-color', 'AC-AS002', '#F3F4F6', 'ASTEL_WHITE', 'astel_texture', 'astel', 'astel', 20, 20, 80, NULL, '아스텔 백색도 20 기준'),
    ('astel-color', 'AC-AS003', '#E5E7EB', 'ASTEL_WHITE', 'astel_texture', 'astel', 'astel', 40, 40, 60, NULL, '아스텔 백색도 40 기준'),
    ('astel-color', 'AC-AS004', '#D1D5DB', 'ASTEL_WHITE', 'astel_texture', 'astel', 'astel', 60, 60, 40, NULL, '아스텔 백색도 60 기준'),
    ('astel-color', 'AC-AS005', '#F1F5F9', 'ASTEL_WHITE', 'astel_texture', 'astel', 'astel', 80, 80, 20, NULL, '아스텔 백색도 80 기준'),
    ('astel-color', 'AC-AS006', '#FFFFFF', 'ASTEL_WHITE', 'astel_texture', 'astel', 'astel', 100, 100, 0, NULL, '아스텔 백색 불투명 기준')
)
UPDATE public.color_options co
SET
  color_code = seed.color_code,
  is_active = true,
  is_producible = true,
  is_bright_pigment = false,
  unavailable_reason = null,
  color_attribute_note = seed.note,
  series_key = seed.series_key,
  pantone = concat('WHITE ', seed.visual_opacity_percent, '%'),
  attributes = COALESCE(co.attributes, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'schema_version', 'color-attributes-v1-260527',
    'color_family', 'white_opacity_reference',
    'material_series', seed.material_series,
    'finish_type', seed.finish_type,
    'texture_type', seed.texture_type,
    'visual_opacity_percent', seed.visual_opacity_percent,
    'white_pigment_percent', seed.white_pigment_percent,
    'transparency_percent', seed.transparency_percent,
    'is_white_opacity_reference', true,
    'equivalent_to', seed.equivalent_to,
    'reference_note', seed.note
  )),
  updated_at = now()
FROM seed
JOIN public.panel_masters pm
  ON pm.material::text = 'acrylic'
 AND pm.quality::text = seed.quality
WHERE co.panel_master_id = pm.id
  AND co.color_name = seed.color_name;

DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  WITH seed (quality, color_name) AS (
    VALUES
      ('glossy-color', 'AC-C001'), ('glossy-color', 'AC-C002'), ('glossy-color', 'AC-C003'),
      ('glossy-color', 'AC-C004'), ('glossy-color', 'AC-C005'), ('glossy-color', 'AC-C006'),
      ('satin-color', 'AC-B001'), ('satin-color', 'AC-B002'), ('satin-color', 'AC-B003'),
      ('satin-color', 'AC-B004'), ('satin-color', 'AC-B005'), ('satin-color', 'AC-B006'),
      ('astel-color', 'AC-AS001'), ('astel-color', 'AC-AS002'), ('astel-color', 'AC-AS003'),
      ('astel-color', 'AC-AS004'), ('astel-color', 'AC-AS005'), ('astel-color', 'AC-AS006')
  )
  SELECT count(*)
  INTO missing_count
  FROM seed
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.color_options co
    JOIN public.panel_masters pm ON pm.id = co.panel_master_id
    WHERE pm.material::text = 'acrylic'
      AND pm.quality::text = seed.quality
      AND co.color_name = seed.color_name
      AND co.attributes ->> 'color_family' = 'white_opacity_reference'
  );

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'White opacity reference color seed incomplete: % rows missing', missing_count;
  END IF;
END $$;
