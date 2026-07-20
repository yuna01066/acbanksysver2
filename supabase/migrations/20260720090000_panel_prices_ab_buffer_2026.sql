-- 2026-06-01 A/B supplier upper-bound sheet price refresh.
--
-- Normalization rule:
-- - B "정3X6" maps to internal "대3*6".
-- - B "3X6(소)" maps to internal "소3*6".
-- - New calculator selections keep only "소3*6" and "대3*6"; legacy "3*6" rows are deactivated, not deleted.
-- - A listed color-sheet prices include tape, so base single-side price uses A listed price minus A tape surcharge.
-- - New base price = ceil(max(A single-side equivalent, B single-side) * 1.03 / 100) * 100.
-- - Option surcharge = ceil(max(A option, B option) * 1.03 / 100) * 100.
-- - Satin and Astel production availability is constrained by the 2026-06-01 surcharge table:
--   Satin: 대3*6, 1*2, 4*8. Astel: 대3*6, 4*5, 대4*5, 1*2, 4*8.

INSERT INTO public.panel_pricing_versions (
  version_name,
  supplier_name,
  effective_from,
  is_active,
  source_note
)
SELECT
  'A/B 원판 상한 2026-06-01 + 3%',
  '장원산업/한영화학',
  DATE '2026-06-01',
  false,
  'A 색상판 테이프 포함가를 단면 환산 후 B 단면가와 비교. 정3X6=대3*6, 3X6(소)=소3*6, 신규 선택지는 소3*6/대3*6만 유지. 3% 버퍼와 100원 올림 적용.'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.panel_pricing_versions
  WHERE version_name = 'A/B 원판 상한 2026-06-01 + 3%'
);

UPDATE public.panel_pricing_versions
SET
  is_active = false,
  effective_to = COALESCE(effective_to, DATE '2026-05-31'),
  updated_at = now()
WHERE is_active = true;

WITH target_version AS (
  SELECT id
  FROM public.panel_pricing_versions
  WHERE version_name = 'A/B 원판 상한 2026-06-01 + 3%'
  ORDER BY created_at DESC
  LIMIT 1
)
UPDATE public.panel_pricing_versions AS version
SET
  is_active = true,
  effective_to = NULL,
  updated_at = now()
FROM target_version
WHERE version.id = target_version.id;

WITH active_version AS (
  SELECT id
  FROM public.panel_pricing_versions
  WHERE version_name = 'A/B 원판 상한 2026-06-01 + 3%'
  ORDER BY created_at DESC
  LIMIT 1
),
glossy_master AS (
  SELECT id
  FROM public.panel_masters
  WHERE material = 'acrylic'
    AND quality = 'glossy-color'
  LIMIT 1
),
seed(thickness, size_name, actual_width, actual_height, price) AS (
  VALUES
    ('1.3T', '소3*6', 850, 1780, 21100),
    ('1.3T', '3*6', 910, 1810, 21900),
    ('1.3T', '대3*6', 950, 1860, 23300),
    ('1.3T', '4*5', 1170, 1475, 23300),
    ('1.5T', '소3*6', 850, 1780, 21100),
    ('1.5T', '3*6', 910, 1810, 21900),
    ('1.5T', '대3*6', 950, 1860, 23900),
    ('1.5T', '4*5', 1170, 1475, 23300),
    ('2T', '소3*6', 850, 1780, 21100),
    ('2T', '3*6', 910, 1810, 21900),
    ('2T', '대3*6', 950, 1860, 23900),
    ('2T', '4*5', 1170, 1475, 23300),
    ('2T', '대4*5', 1250, 1550, 26300),
    ('2T', '1*2', 1050, 2050, 29200),
    ('3T', '소3*6', 850, 1780, 27900),
    ('3T', '3*6', 910, 1810, 28900),
    ('3T', '대3*6', 950, 1860, 32000),
    ('3T', '4*5', 1170, 1475, 30900),
    ('3T', '대4*5', 1250, 1550, 35100),
    ('3T', '소1*2', 1040, 1860, 34000),
    ('3T', '1*2', 1050, 2050, 39200),
    ('3T', '4*6', 1250, 1860, 41800),
    ('3T', '4*8', 1250, 2450, 55700),
    ('4T', '소3*6', 850, 1780, 37100),
    ('4T', '3*6', 910, 1810, 38500),
    ('4T', '대3*6', 950, 1860, 42300),
    ('4T', '4*5', 1170, 1475, 41200),
    ('4T', '대4*5', 1250, 1550, 46900),
    ('4T', '소1*2', 1040, 1860, 45900),
    ('4T', '1*2', 1050, 2050, 51500),
    ('4T', '4*6', 1250, 1860, 55700),
    ('4T', '4*8', 1250, 2450, 74200),
    ('5T', '소3*6', 850, 1780, 46400),
    ('5T', '3*6', 910, 1810, 48500),
    ('5T', '대3*6', 950, 1860, 53100),
    ('5T', '4*5', 1170, 1475, 51500),
    ('5T', '대4*5', 1250, 1550, 58800),
    ('5T', '소1*2', 1040, 1860, 57700),
    ('5T', '1*2', 1050, 2050, 64900),
    ('5T', '4*6', 1250, 1860, 69600),
    ('5T', '4*8', 1250, 2450, 92700),
    ('5T', '4*10', 1250, 3050, 170000),
    ('5T', '5*6', 1550, 1850, 116100),
    ('5T', '5*8', 1550, 2450, 153700),
    ('6T', '소3*6', 850, 1780, 55700),
    ('6T', '3*6', 910, 1810, 59100),
    ('6T', '대3*6', 950, 1860, 63900),
    ('6T', '4*5', 1170, 1475, 61800),
    ('6T', '대4*5', 1250, 1550, 70100),
    ('6T', '소1*2', 1040, 1860, 69600),
    ('6T', '1*2', 1050, 2050, 77800),
    ('6T', '4*6', 1250, 1860, 83500),
    ('6T', '4*8', 1250, 2450, 111300),
    ('6T', '4*10', 1250, 3050, 204800),
    ('6T', '5*6', 1550, 1850, 140500),
    ('6T', '5*8', 1550, 2450, 185700),
    ('8T', '소3*6', 850, 1780, 74200),
    ('8T', '3*6', 910, 1810, 78300),
    ('8T', '대3*6', 950, 1860, 85000),
    ('8T', '4*5', 1170, 1475, 82400),
    ('8T', '대4*5', 1250, 1550, 93800),
    ('8T', '소1*2', 1040, 1860, 92700),
    ('8T', '1*2', 1050, 2050, 104100),
    ('8T', '4*6', 1250, 1860, 111300),
    ('8T', '4*8', 1250, 2450, 148400),
    ('8T', '4*10', 1250, 3050, 273500),
    ('8T', '5*6', 1550, 1850, 187800),
    ('8T', '5*8', 1550, 2450, 248300),
    ('10T', '소3*6', 850, 1780, 92700),
    ('10T', '3*6', 910, 1810, 97400),
    ('10T', '대3*6', 950, 1860, 106700),
    ('10T', '4*5', 1170, 1475, 103000),
    ('10T', '대4*5', 1250, 1550, 117000),
    ('10T', '소1*2', 1040, 1860, 115400),
    ('10T', '1*2', 1050, 2050, 129800),
    ('10T', '4*6', 1250, 1860, 139100),
    ('10T', '4*8', 1250, 2450, 185400),
    ('10T', '4*10', 1250, 3050, 341500),
    ('10T', '5*6', 1550, 1850, 233700),
    ('10T', '5*8', 1550, 2450, 309500),
    ('12T', '소3*6', 850, 1780, 124700),
    ('12T', '3*6', 910, 1810, 127600),
    ('12T', '대3*6', 950, 1860, 143100),
    ('12T', '4*5', 1170, 1475, 138500),
    ('12T', '대4*5', 1250, 1550, 157000),
    ('12T', '소1*2', 1040, 1860, 150700),
    ('12T', '1*2', 1050, 2050, 174300),
    ('12T', '4*6', 1250, 1860, 187000),
    ('12T', '4*8', 1250, 2450, 249300),
    ('12T', '4*10', 1250, 3050, 446100),
    ('12T', '5*6', 1550, 1850, 305200),
    ('12T', '5*8', 1550, 2450, 403800),
    ('15T', '소3*6', 850, 1780, 155800),
    ('15T', '3*6', 910, 1810, 159000),
    ('15T', '대3*6', 950, 1860, 178900),
    ('15T', '4*5', 1170, 1475, 173100),
    ('15T', '대4*5', 1250, 1550, 196800),
    ('15T', '소1*2', 1040, 1860, 188300),
    ('15T', '1*2', 1050, 2050, 218100),
    ('15T', '4*6', 1250, 1860, 233700),
    ('15T', '4*8', 1250, 2450, 311500),
    ('15T', '4*10', 1250, 3050, 557500),
    ('15T', '5*6', 1550, 1850, 381700),
    ('15T', '5*8', 1550, 2450, 506200),
    ('20T', '소3*6', 850, 1780, 213300),
    ('20T', '3*6', 910, 1810, 217500),
    ('20T', '대3*6', 950, 1860, 245300),
    ('20T', '4*5', 1170, 1475, 236900),
    ('20T', '대4*5', 1250, 1550, 269000),
    ('20T', '소1*2', 1040, 1860, 258100),
    ('20T', '1*2', 1050, 2050, 298500),
    ('20T', '4*6', 1250, 1860, 319900),
    ('20T', '4*8', 1250, 2450, 426500),
    ('20T', '4*10', 1250, 3050, 767600),
    ('20T', '5*6', 1550, 1850, 524800),
    ('20T', '5*8', 1550, 2450, 696900),
    ('25T', '소3*6', 850, 1780, 285200),
    ('25T', '3*6', 910, 1810, 283000),
    ('25T', '대3*6', 950, 1860, 327600),
    ('25T', '4*5', 1170, 1475, 316800),
    ('25T', '대4*5', 1250, 1550, 359900),
    ('25T', '소1*2', 1040, 1860, 336900),
    ('25T', '1*2', 1050, 2050, 399200),
    ('25T', '4*6', 1250, 1860, 427700),
    ('25T', '4*8', 1250, 2450, 576500),
    ('25T', '4*10', 1250, 3050, 1009100),
    ('25T', '5*6', 1550, 1850, 689800),
    ('25T', '5*8', 1550, 2450, 918500),
    ('30T', '소3*6', 850, 1780, 361600),
    ('30T', '3*6', 910, 1810, 347100),
    ('30T', '대3*6', 950, 1860, 415900),
    ('30T', '4*5', 1170, 1475, 401700),
    ('30T', '대4*5', 1250, 1550, 456000),
    ('30T', '소1*2', 1040, 1860, 414600),
    ('30T', '1*2', 1050, 2050, 506200),
    ('30T', '4*6', 1250, 1860, 542300),
    ('30T', '4*8', 1250, 2450, 723100),
    ('30T', '4*10', 1250, 3050, 1252300),
    ('30T', '5*6', 1550, 1850, 854800),
    ('30T', '5*8', 1550, 2450, 1141400)
)
INSERT INTO public.panel_sizes (
  panel_master_id,
  thickness,
  size_name,
  actual_width,
  actual_height,
  price,
  pricing_version_id,
  is_active
)
SELECT
  glossy_master.id,
  seed.thickness,
  seed.size_name,
  seed.actual_width,
  seed.actual_height,
  seed.price,
  active_version.id,
  true
FROM seed
CROSS JOIN glossy_master
CROSS JOIN active_version
ON CONFLICT (panel_master_id, thickness, size_name)
DO UPDATE SET
  actual_width = EXCLUDED.actual_width,
  actual_height = EXCLUDED.actual_height,
  price = EXCLUDED.price,
  pricing_version_id = EXCLUDED.pricing_version_id,
  is_active = true,
  updated_at = now();

WITH active_version AS (
  SELECT id
  FROM public.panel_pricing_versions
  WHERE version_name = 'A/B 원판 상한 2026-06-01 + 3%'
  ORDER BY created_at DESC
  LIMIT 1
),
seed(surcharge_type, size_name, cost, notes) AS (
  VALUES
    ('double_surface', '소3*6', 2700, 'A/B 상한 + 3% 양단면 추가금'),
    ('double_surface', '3*6', 2900, 'A/B 상한 + 3% 양단면 추가금'),
    ('double_surface', '대3*6', 3100, 'A/B 상한 + 3% 양단면 추가금'),
    ('double_surface', '4*5', 3100, 'A/B 상한 + 3% 양단면 추가금'),
    ('double_surface', '대4*5', 3300, 'A/B 상한 + 3% 양단면 추가금'),
    ('double_surface', '소1*2', 3300, 'A/B 상한 + 3% 양단면 추가금'),
    ('double_surface', '1*2', 3800, 'A/B 상한 + 3% 양단면 추가금'),
    ('double_surface', '4*6', 4200, 'A/B 상한 + 3% 양단면 추가금'),
    ('double_surface', '4*8', 5200, 'A/B 상한 + 3% 양단면 추가금'),
    ('double_surface', '4*10', 10300, 'A/B 상한 + 3% 양단면 추가금'),
    ('double_surface', '5*6', 8300, 'A/B 상한 + 3% 양단면 추가금'),
    ('double_surface', '5*8', 10300, 'A/B 상한 + 3% 양단면 추가금'),
    ('satin_astel', '소3*6', 5200, 'A/B 상한 + 3% 사틴/아스텔 추가금'),
    ('satin_astel', '대3*6', 7300, 'A/B 상한 + 3% 사틴/아스텔 추가금'),
    ('satin_astel', '4*5', 5200, 'A/B 상한 + 3% 사틴/아스텔 추가금'),
    ('satin_astel', '대4*5', 6200, 'A/B 상한 + 3% 사틴/아스텔 추가금'),
    ('satin_astel', '소1*2', 6200, 'A/B 상한 + 3% 사틴/아스텔 추가금'),
    ('satin_astel', '1*2', 10300, 'A/B 상한 + 3% 사틴/아스텔 추가금'),
    ('satin_astel', '4*6', 7300, 'A/B 상한 + 3% 사틴/아스텔 추가금'),
    ('satin_astel', '4*8', 14500, 'A/B 상한 + 3% 사틴/아스텔 추가금'),
    ('satin_astel', '4*10', 20600, 'A/B 상한 + 3% 사틴/아스텔 추가금'),
    ('satin_astel', '5*8', 20600, 'A/B 상한 + 3% 사틴/아스텔 추가금'),
    ('bright_pigment', '소3*6', 3100, 'B 진백/반짝이 + 3% 브라이트/화이트 안료 추가금'),
    ('bright_pigment', '3*6', 3100, 'B 진백/반짝이 + 3% 브라이트/화이트 안료 추가금'),
    ('bright_pigment', '대3*6', 3100, 'B 진백/반짝이 + 3% 브라이트/화이트 안료 추가금'),
    ('bright_pigment', '4*5', 3100, 'B 진백/반짝이 + 3% 브라이트/화이트 안료 추가금'),
    ('bright_pigment', '대4*5', 3100, 'B 진백/반짝이 + 3% 브라이트/화이트 안료 추가금'),
    ('bright_pigment', '1*2', 4200, 'B 진백/반짝이 + 3% 브라이트/화이트 안료 추가금'),
    ('bright_pigment', '4*6', 4200, 'B 진백/반짝이 + 3% 브라이트/화이트 안료 추가금'),
    ('bright_pigment', '4*8', 5200, 'B 진백/반짝이 + 3% 브라이트/화이트 안료 추가금')
)
INSERT INTO public.panel_option_surcharges (
  quality_id,
  surcharge_type,
  size_name,
  cost,
  pricing_version_id,
  is_active,
  notes
)
SELECT
  'global',
  seed.surcharge_type,
  seed.size_name,
  seed.cost,
  active_version.id,
  true,
  seed.notes
FROM seed
CROSS JOIN active_version
ON CONFLICT (quality_id, surcharge_type, size_name)
DO UPDATE SET
  cost = EXCLUDED.cost,
  pricing_version_id = EXCLUDED.pricing_version_id,
  is_active = true,
  notes = EXCLUDED.notes,
  updated_at = now();

WITH active_version AS (
  SELECT id
  FROM public.panel_pricing_versions
  WHERE version_name = 'A/B 원판 상한 2026-06-01 + 3%'
  ORDER BY created_at DESC
  LIMIT 1
),
seed(quality_id, surcharge_type, size_name, cost, notes) AS (
  VALUES
    ('satin-color', 'satin_astel', '대3*6', 7300, '2026-06-01 생산 규격 제한 + A/B 상한 + 3% 사틴 추가금'),
    ('satin-color', 'satin_astel', '1*2', 10300, '2026-06-01 생산 규격 제한 + A/B 상한 + 3% 사틴 추가금'),
    ('satin-color', 'satin_astel', '4*8', 14500, '2026-06-01 생산 규격 제한 + A/B 상한 + 3% 사틴 추가금'),
    ('astel-color', 'satin_astel', '대3*6', 5200, '2026-06-01 생산 규격 제한 + A/B 상한 + 3% 아스텔 추가금'),
    ('astel-color', 'satin_astel', '4*5', 5200, '2026-06-01 생산 규격 제한 + A/B 상한 + 3% 아스텔 추가금'),
    ('astel-color', 'satin_astel', '대4*5', 6200, '2026-06-01 생산 규격 제한 + A/B 상한 + 3% 아스텔 추가금'),
    ('astel-color', 'satin_astel', '1*2', 7300, '2026-06-01 생산 규격 제한 + A/B 상한 + 3% 아스텔 추가금'),
    ('astel-color', 'satin_astel', '4*8', 10300, '2026-06-01 생산 규격 제한 + A/B 상한 + 3% 아스텔 추가금')
)
INSERT INTO public.panel_option_surcharges (
  quality_id,
  surcharge_type,
  size_name,
  cost,
  pricing_version_id,
  is_active,
  notes
)
SELECT
  seed.quality_id,
  seed.surcharge_type,
  seed.size_name,
  seed.cost,
  active_version.id,
  true,
  seed.notes
FROM seed
CROSS JOIN active_version
ON CONFLICT (quality_id, surcharge_type, size_name)
DO UPDATE SET
  cost = EXCLUDED.cost,
  pricing_version_id = EXCLUDED.pricing_version_id,
  is_active = true,
  notes = EXCLUDED.notes,
  updated_at = now();

WITH allowed_sizes(quality, size_name) AS (
  VALUES
    ('satin-color', '대3*6'),
    ('satin-color', '1*2'),
    ('satin-color', '4*8'),
    ('astel-color', '대3*6'),
    ('astel-color', '4*5'),
    ('astel-color', '대4*5'),
    ('astel-color', '1*2'),
    ('astel-color', '4*8')
)
UPDATE public.panel_sizes AS size
SET
  is_active = EXISTS (
    SELECT 1
    FROM allowed_sizes
    WHERE allowed_sizes.quality = master.quality::text
      AND allowed_sizes.size_name = size.size_name
  ),
  updated_at = now()
FROM public.panel_masters AS master
WHERE size.panel_master_id = master.id
  AND master.quality::text IN ('satin-color', 'astel-color');

WITH allowed_surcharges(quality_id, size_name) AS (
  VALUES
    ('satin-color', '대3*6'),
    ('satin-color', '1*2'),
    ('satin-color', '4*8'),
    ('astel-color', '대3*6'),
    ('astel-color', '4*5'),
    ('astel-color', '대4*5'),
    ('astel-color', '1*2'),
    ('astel-color', '4*8')
)
UPDATE public.panel_option_surcharges AS surcharge
SET
  is_active = EXISTS (
    SELECT 1
    FROM allowed_surcharges
    WHERE allowed_surcharges.quality_id = surcharge.quality_id
      AND allowed_surcharges.size_name = surcharge.size_name
  ),
  updated_at = now()
WHERE surcharge.quality_id IN ('satin-color', 'astel-color')
  AND surcharge.surcharge_type = 'satin_astel';

UPDATE public.panel_sizes
SET
  is_active = false,
  updated_at = now()
WHERE size_name = '3*6';

UPDATE public.panel_option_surcharges
SET
  is_active = false,
  updated_at = now()
WHERE size_name = '3*6';

COMMENT ON COLUMN public.panel_sizes.price IS '원판 단면 기준가. 2026-06-01 이후 glossy-color는 A/B 공급가 상한 + 3% 버퍼, 100원 올림 기준. 정3X6=대3*6, 3X6(소)=소3*6, 신규 선택지는 소3*6/대3*6만 유지.';
