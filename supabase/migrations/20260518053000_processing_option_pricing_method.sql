-- Add explicit pricing method fields for processing options.
-- Existing multiplier/base_cost values remain valid through legacy_multiplier.

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

COMMENT ON COLUMN public.processing_options.pricing_method IS
  '가공 옵션 계산 방식: 기존 배수, 고정비, 원장 배수/추가율, 단위 단가, 검수 필요 등';
COMMENT ON COLUMN public.processing_options.unit IS '단가 단위. 예: m, ea, corner, bevel_m';
COMMENT ON COLUMN public.processing_options.rate IS 'pricing_method에서 사용하는 단가 또는 추가율';
COMMENT ON COLUMN public.processing_options.requires_review IS '선택 시 견적 결과를 검수 필요 상태로 표시';

UPDATE public.processing_options
SET pricing_method = CASE
    WHEN option_id = 'raw-only' THEN 'panel_multiplier'
    WHEN option_type = 'additional' OR category = 'additional' THEN 'panel_rate'
    WHEN multiplier IS NOT NULL AND multiplier >= 1 THEN 'panel_multiplier'
    WHEN multiplier IS NOT NULL AND multiplier > 0 THEN 'panel_rate'
    WHEN base_cost IS NOT NULL AND base_cost <> 0 THEN 'fixed_fee'
    ELSE pricing_method
  END,
  rate = CASE
    WHEN option_type = 'additional' OR category = 'additional' THEN COALESCE(rate, multiplier)
    WHEN base_cost IS NOT NULL AND base_cost <> 0 THEN COALESCE(rate, base_cost)
    ELSE rate
  END
WHERE pricing_method = 'legacy_multiplier';
