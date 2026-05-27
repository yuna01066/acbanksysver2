-- Add structured material/color attributes for ACBANK color options.
-- This migration is intentionally additive. It does not recalculate quote prices.

ALTER TABLE public.color_options
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_color_options_attributes
  ON public.color_options USING GIN (attributes);

COMMENT ON COLUMN public.color_options.attributes IS
  'Structured color/material metadata such as opacity level, texture, pigment, pricing family, and reference color codes.';

CREATE TEMP TABLE acbank_white_opacity_attributes (
  quality TEXT NOT NULL,
  color_name TEXT NOT NULL,
  series_key TEXT NOT NULL,
  material_series TEXT NOT NULL,
  finish_type TEXT NOT NULL,
  texture_type TEXT NOT NULL,
  visual_opacity_percent INTEGER NOT NULL,
  white_pigment_percent INTEGER NOT NULL,
  transparency_percent INTEGER NOT NULL,
  is_white_opacity_reference BOOLEAN NOT NULL,
  equivalent_to TEXT,
  note TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO acbank_white_opacity_attributes (
  quality,
  color_name,
  series_key,
  material_series,
  finish_type,
  texture_type,
  visual_opacity_percent,
  white_pigment_percent,
  transparency_percent,
  is_white_opacity_reference,
  equivalent_to,
  note
)
VALUES
  -- CLEAR glossy white/transparency reference scale.
  ('glossy-color', 'AC-C001', 'CLEAR_WHITE', 'clear_glossy', 'glossy', 'none', 0, 0, 100, true, NULL, '투명 유광 기준'),
  ('glossy-color', 'AC-C002', 'CLEAR_WHITE', 'clear_glossy', 'glossy', 'none', 20, 20, 80, true, NULL, '유광 백색도 20 기준'),
  ('glossy-color', 'AC-C003', 'CLEAR_WHITE', 'clear_glossy', 'glossy', 'none', 40, 40, 60, true, NULL, '유광 백색도 40 기준'),
  ('glossy-color', 'AC-C004', 'CLEAR_WHITE', 'clear_glossy', 'glossy', 'none', 60, 60, 40, true, NULL, '유광 백색도 60 기준'),
  ('glossy-color', 'AC-C005', 'CLEAR_WHITE', 'clear_glossy', 'glossy', 'none', 80, 80, 20, true, NULL, '유광 백색도 80 기준'),
  ('glossy-color', 'AC-C006', 'CLEAR_WHITE', 'clear_glossy', 'glossy', 'none', 100, 100, 0, true, NULL, '유광 백색 불투명 기준'),

  -- Satin texture white/suri reference scale.
  -- AC-B001 is visually translucent because of the satin texture, not because of white pigment.
  ('satin-color', 'AC-B001', 'SATIN_WHITE', 'satin_texture', 'satin_matte', 'satin_matte', 10, 0, 100, true, 'AC-ST', '투명 아크릴에 무광 사틴 텍스처만 있는 기준. AC-ST 사틴 투명 계열과 동일하게 취급'),
  ('satin-color', 'AC-B002', 'SATIN_WHITE', 'satin_texture', 'satin_matte', 'satin_matte', 20, 20, 80, true, NULL, '사틴 텍스처 백색도 20 기준'),
  ('satin-color', 'AC-B003', 'SATIN_WHITE', 'satin_texture', 'satin_matte', 'satin_matte', 40, 40, 60, true, NULL, '사틴 텍스처 백색도 40 기준'),
  ('satin-color', 'AC-B004', 'SATIN_WHITE', 'satin_texture', 'satin_matte', 'satin_matte', 60, 60, 40, true, NULL, '사틴 텍스처 백색도 60 기준. Bright 시리즈의 스리/진백 기준 베이스'),
  ('satin-color', 'AC-B005', 'SATIN_WHITE', 'satin_texture', 'satin_matte', 'satin_matte', 80, 80, 20, true, NULL, '사틴 텍스처 백색도 80 기준'),
  ('satin-color', 'AC-B006', 'SATIN_WHITE', 'satin_texture', 'satin_matte', 'satin_matte', 100, 100, 0, true, NULL, '사틴 텍스처 백색 불투명 기준'),

  -- Astel white/transparency reference scale.
  ('astel-color', 'AC-AS001', 'ASTEL_WHITE', 'astel_texture', 'astel', 'astel', 0, 0, 100, true, NULL, '아스텔 투명 기준'),
  ('astel-color', 'AC-AS002', 'ASTEL_WHITE', 'astel_texture', 'astel', 'astel', 20, 20, 80, true, NULL, '아스텔 백색도 20 기준'),
  ('astel-color', 'AC-AS003', 'ASTEL_WHITE', 'astel_texture', 'astel', 'astel', 40, 40, 60, true, NULL, '아스텔 백색도 40 기준'),
  ('astel-color', 'AC-AS004', 'ASTEL_WHITE', 'astel_texture', 'astel', 'astel', 60, 60, 40, true, NULL, '아스텔 백색도 60 기준'),
  ('astel-color', 'AC-AS005', 'ASTEL_WHITE', 'astel_texture', 'astel', 'astel', 80, 80, 20, true, NULL, '아스텔 백색도 80 기준'),
  ('astel-color', 'AC-AS006', 'ASTEL_WHITE', 'astel_texture', 'astel', 'astel', 100, 100, 0, true, NULL, '아스텔 백색 불투명 기준');

UPDATE public.color_options co
SET
  series_key = COALESCE(co.series_key, attrs.series_key),
  color_attribute_note = COALESCE(co.color_attribute_note, attrs.note),
  attributes = COALESCE(co.attributes, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'schema_version', 'color-attributes-v1-260527',
    'color_family', 'white_opacity_reference',
    'material_series', attrs.material_series,
    'finish_type', attrs.finish_type,
    'texture_type', attrs.texture_type,
    'visual_opacity_percent', attrs.visual_opacity_percent,
    'white_pigment_percent', attrs.white_pigment_percent,
    'transparency_percent', attrs.transparency_percent,
    'is_white_opacity_reference', attrs.is_white_opacity_reference,
    'equivalent_to', attrs.equivalent_to,
    'reference_note', attrs.note
  )),
  updated_at = now()
FROM acbank_white_opacity_attributes attrs
JOIN public.panel_masters pm
  ON pm.quality::text = attrs.quality
WHERE co.panel_master_id = pm.id
  AND co.color_name = attrs.color_name;

-- Bright colors use AC-B004 as the suri/jinbaek white pigment base.
-- The color itself remains a Bright color; the white-base relationship is stored as metadata.
UPDATE public.color_options co
SET
  is_bright_pigment = true,
  color_attribute_note = COALESCE(co.color_attribute_note, 'Bright 색상: AC-B004 백색 안료 60 기준 베이스'),
  attributes = COALESCE(co.attributes, '{}'::jsonb) || jsonb_build_object(
    'schema_version', 'color-attributes-v1-260527',
    'color_family', 'bright_color',
    'material_series', 'bright_pigment',
    'finish_type', 'glossy',
    'texture_type', 'none',
    'white_base_code', 'AC-B004',
    'white_base_material_series', 'satin_texture',
    'white_base_visual_opacity_percent', 60,
    'white_base_pigment_percent', 60,
    'requires_bright_pigment_surcharge', true
  ),
  updated_at = now()
FROM public.panel_masters pm
WHERE co.panel_master_id = pm.id
  AND pm.quality::text = 'bright-color';
