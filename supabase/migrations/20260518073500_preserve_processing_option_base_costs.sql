-- Preserve legacy multiplier + base_cost processing option behavior.
-- Some rows, such as full-cutting options, intentionally use both a panel
-- multiplier and a fixed setup/base cost. The rate field must represent the
-- multiplier for panel methods; base_cost remains a separate additive cost.

ALTER TABLE public.processing_options
  ADD COLUMN IF NOT EXISTS pricing_method TEXT NOT NULL DEFAULT 'legacy_multiplier',
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS rate NUMERIC,
  ADD COLUMN IF NOT EXISTS requires_review BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.processing_options
  DROP CONSTRAINT IF EXISTS processing_options_pricing_method_check;

ALTER TABLE public.processing_options
  ADD CONSTRAINT processing_options_pricing_method_check
  CHECK (
    pricing_method IN (
      'legacy_multiplier',
      'fixed_fee',
      'panel_multiplier',
      'panel_rate',
      'per_unit',
      'per_meter',
      'per_corner',
      'requires_review'
    )
  );

UPDATE public.processing_options
SET pricing_method = CASE
    WHEN option_id = 'raw-only' THEN 'panel_multiplier'
    WHEN option_type = 'additional' OR category = 'additional' THEN 'panel_rate'
    WHEN multiplier IS NOT NULL AND multiplier >= 1 THEN 'panel_multiplier'
    WHEN multiplier IS NOT NULL AND multiplier > 0 THEN 'panel_rate'
    WHEN base_cost IS NOT NULL AND base_cost <> 0 THEN 'fixed_fee'
    ELSE pricing_method
  END
WHERE pricing_method = 'legacy_multiplier';

UPDATE public.processing_options
SET rate = multiplier
WHERE multiplier IS NOT NULL
  AND multiplier > 0
  AND pricing_method IN ('panel_multiplier', 'panel_rate')
  AND (
    rate IS NULL
    OR rate = 0
    OR (base_cost IS NOT NULL AND rate = base_cost)
  );

UPDATE public.processing_options
SET rate = base_cost
WHERE pricing_method = 'fixed_fee'
  AND base_cost IS NOT NULL
  AND base_cost <> 0
  AND (rate IS NULL OR rate = 0);
