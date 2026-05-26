-- Satin Mirror is priced as CLEAR base + color mixing + satin texture + mirror deposition.
-- Keep color selection sourced from CLEAR in the UI, and make the DB default explicit.

INSERT INTO public.panel_masters (material, quality, name, description)
VALUES
  ('acrylic', 'satin-mirror', 'Satin Mirror (사틴 미러)', 'CLEAR 색상 + 조색비 + 사틴 질감 + 미러증착 비용 기준')
ON CONFLICT (material, quality) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();

WITH target_master AS (
  SELECT id
  FROM public.panel_masters
  WHERE material = 'acrylic'
    AND quality::text = 'satin-mirror'
),
default_costs AS (
  SELECT *
  FROM (VALUES
    ('1.3T', 40000),
    ('1.5T', 40000),
    ('2T', 40000),
    ('3T', 40000),
    ('4T', 40000),
    ('5T', 40000),
    ('6T', 40000),
    ('8T', 40000),
    ('10T', 40000),
    ('12T', 40000),
    ('15T', 40000),
    ('20T', 40000),
    ('25T', 40000),
    ('30T', 40000)
  ) AS costs(thickness, cost)
)
INSERT INTO public.color_mixing_costs (
  panel_master_id,
  thickness,
  cost
)
SELECT
  tm.id,
  dc.thickness,
  dc.cost
FROM target_master tm
CROSS JOIN default_costs dc
ON CONFLICT (panel_master_id, thickness) DO UPDATE SET
  cost = CASE
    WHEN public.color_mixing_costs.cost IS NULL OR public.color_mixing_costs.cost <= 0
      THEN EXCLUDED.cost
    ELSE public.color_mixing_costs.cost
  END,
  updated_at = now();
