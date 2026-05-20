-- Quote calculation formula v2 defaults from docs/logic-specs/quote-calculation-core-formula-260520.md
-- These rows only provide editable defaults. They do not recalculate or mutate saved quote amounts.

INSERT INTO public.advanced_processing_settings (setting_key, setting_value, display_name, description, unit) VALUES
  ('raw_only_multiplier', 1.8, '원판 단독 구매 배수', '신규 계산 산식 v2: 원판 단독 구매 최종 배수', '배'),
  ('simple_cut_thin_multiplier', 1.2, '단순 재단 배수(10T 미만)', '신규 계산 산식 v2: 10T 미만 단순 재단 최종 배수', '배'),
  ('simple_cut_thick_multiplier', 1.8, '단순 재단 배수(10T 이상)', '신규 계산 산식 v2: 10T 이상 단순 재단 최종 배수', '배'),
  ('fabrication_base_multiplier', 1.3, '가공 기준 배수', '신규 계산 산식 v2: 복합 재단/레이저/CNC 기본 원장 배수', '배'),
  ('complex_cut_setup_fee', 70000, '복합 재단 기본 공임', '신규 계산 산식 v2: 복합 재단 정액 공임', '원'),
  ('laser_thin_fee', 50000, '레이저 공임(10T 이하)', '신규 계산 산식 v2: 10T 이하 레이저 정액 공임', '원'),
  ('laser_thick_fee', 70000, '레이저 공임(10T 초과)', '신규 계산 산식 v2: 10T 초과/복합 레이저 정액 공임', '원'),
  ('laser_full_thin_sheet_fee', 200000, '전체 레이저 공임(1~2T)', '신규 계산 산식 v2: 1~2T 한판 전체 레이저 정액 공임', '원'),
  ('cnc_general_fee', 70000, 'CNC 일반 공임', '신규 계산 산식 v2: CNC 일반 정액 공임', '원'),
  ('cnc_heavy_fee', 100000, 'CNC 고강도 공임', '신규 계산 산식 v2: 20~30T 또는 고강도 CNC 정액 공임', '원'),
  ('complex_shape_fee', 250000, '복잡 형상 공임', '신규 계산 산식 v2: 복잡 형상 가공 기본 공임', '원'),
  ('mugipo45_thin_multiplier', 3.2, '무기포 45도 배수(10T 미만)', '신규 계산 산식 v2: 원판 기준 무기포 45도 10T 미만 최종 배수', '배'),
  ('mugipo45_thick_multiplier', 3.3, '무기포 45도 배수(10T 이상)', '신규 계산 산식 v2: 원판 기준 무기포 45도 10T 이상 최종 배수', '배'),
  ('mugipo90_multiplier', 3.5, '무기포 90도 배수', '신규 계산 산식 v2: 원판 기준 무기포 90도 기준 배수', '배'),
  ('mugipo_box_setup_fee', 50000, '무기포 박스 세팅비', '제품 기준 무기포 박스 상세 계산용 세팅비', '원'),
  ('mugipo_box_bond_rate_per_m', 45000, '무기포 박스 접착 공임', '제품 기준 무기포 박스 상세 계산용 접착선 m당 공임', '원/m'),
  ('mugipo_box_min_sale_price_5t_250_cube', 300000, '5T 박스 최소 판매가', '5T 무기포 6면체 박스 기준 최소 판매가', '원'),
  ('polished_edge_rate_per_m', 14200, '경면/유광 엣지 기준 단가', '불광 계산의 기준이 되는 경면/유광 엣지 m당 단가입니다. 미러증착과 별도입니다.', '원/m'),
  ('bulgwang_finish_multiplier', 3.0, '불광 후가공 배수', '불광은 표면을 매끄럽고 투명하게 하는 후가공이며 경면/유광 엣지 기준금액에 곱합니다.', '배'),
  ('mirror_hard_coating_3x6', 200000, '미러 하드코팅 3*6', '미러 증착용 하드코팅 3*6 원판 1장 기준 추가금', '원/장'),
  ('mirror_hard_coating_4x8', 300000, '미러 하드코팅 4*8', '미러 증착용 하드코팅 4*8 원판 1장 기준 추가금', '원/장')
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  is_active = true,
  updated_at = now();

UPDATE public.processing_options
SET pricing_method = 'panel_multiplier',
    multiplier = 1.3,
    rate = NULL,
    base_cost = CASE option_id
      WHEN 'complex-cutting' THEN 70000
      WHEN 'laser-simple' THEN 50000
      WHEN 'laser-cutting-simple' THEN 50000
      WHEN 'laser-complex' THEN 70000
      WHEN 'laser-full' THEN 200000
      WHEN 'laser-cutting-full' THEN 200000
      WHEN 'cnc-simple' THEN 70000
      WHEN 'cnc-general' THEN 70000
      WHEN 'cnc-complex' THEN 100000
      WHEN 'cnc-full' THEN 100000
      WHEN 'cnc-heavy' THEN 100000
      WHEN 'complex-shapes' THEN 250000
      ELSE base_cost
    END
WHERE option_id IN (
  'complex-cutting',
  'laser-simple',
  'laser-cutting-simple',
  'laser-complex',
  'laser-full',
  'laser-cutting-full',
  'cnc-simple',
  'cnc-general',
  'cnc-complex',
  'cnc-full',
  'cnc-heavy',
  'complex-shapes'
);

INSERT INTO public.processing_options (
  option_type,
  category,
  option_id,
  name,
  description,
  multiplier,
  base_cost,
  pricing_method,
  unit,
  rate,
  requires_review,
  min_quantity,
  allow_multiple,
  is_active,
  display_order
) VALUES
  (
    'additional',
    'additional',
    'mirrorHardCoating',
    '미러 증착용 하드코팅',
    '미러증착 원판에 적용하는 하드코팅입니다. 3*6은 장당 200,000원, 4*8은 장당 300,000원입니다.',
    NULL,
    NULL,
    'per_unit',
    'panel',
    NULL,
    false,
    0,
    true,
    true,
    80
  )
ON CONFLICT (option_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  pricing_method = EXCLUDED.pricing_method,
  unit = EXCLUDED.unit,
  min_quantity = EXCLUDED.min_quantity,
  allow_multiple = EXCLUDED.allow_multiple,
  is_active = true,
  display_order = EXCLUDED.display_order,
  updated_at = now();

UPDATE public.processing_options
SET name = '경면/유광 엣지 마감',
    description = '엣지 길이 기준으로 계산하는 경면/유광 엣지 후가공입니다.',
    pricing_method = 'per_meter',
    unit = 'polished_edge_m',
    rate = 14200,
    multiplier = 0.5,
    display_order = LEAST(display_order, 1),
    updated_at = now()
WHERE option_id = 'edgeFinishing';

UPDATE public.processing_options
SET name = '불광 후가공',
    description = '표면을 매끄럽고 투명하게 만드는 불광 후가공입니다. 미러증착과 별도로 계산됩니다.',
    pricing_method = 'per_meter',
    unit = 'polished_edge_m',
    rate = 14200,
    multiplier = 0.5,
    requires_review = true,
    display_order = LEAST(display_order, 2),
    updated_at = now()
WHERE option_id = 'bulgwang';
