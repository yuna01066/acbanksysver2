CREATE TABLE IF NOT EXISTS public.panel_pricing_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_name TEXT NOT NULL,
  supplier_name TEXT NOT NULL DEFAULT '장원산업',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  source_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.panel_pricing_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view pricing versions" ON public.panel_pricing_versions;
CREATE POLICY "Authenticated users can view pricing versions"
  ON public.panel_pricing_versions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage pricing versions" ON public.panel_pricing_versions;
CREATE POLICY "Authenticated users can manage pricing versions"
  ON public.panel_pricing_versions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS update_panel_pricing_versions_updated_at ON public.panel_pricing_versions;
CREATE TRIGGER update_panel_pricing_versions_updated_at
  BEFORE UPDATE ON public.panel_pricing_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX IF NOT EXISTS idx_panel_pricing_versions_single_active
  ON public.panel_pricing_versions (is_active)
  WHERE is_active = true;

INSERT INTO public.panel_pricing_versions (
  version_name,
  supplier_name,
  effective_from,
  is_active,
  source_note
)
VALUES (
  '장원산업 2026-05 단가표',
  '장원산업',
  DATE '2026-05-14',
  true,
  '2026-05-14 업데이트 기준. CLEAR 유광 기본가 + 사이즈별 사틴/아스텔/양단면/브라이트 조색 추가금.'
)
ON CONFLICT DO NOTHING;

ALTER TABLE public.color_options
  ADD COLUMN IF NOT EXISTS is_producible BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_bright_pigment BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unavailable_reason TEXT,
  ADD COLUMN IF NOT EXISTS color_attribute_note TEXT;

ALTER TABLE public.panel_sizes
  ADD COLUMN IF NOT EXISTS pricing_version_id UUID REFERENCES public.panel_pricing_versions(id) ON DELETE SET NULL;

ALTER TABLE public.panel_option_surcharges
  ADD COLUMN IF NOT EXISTS pricing_version_id UUID REFERENCES public.panel_pricing_versions(id) ON DELETE SET NULL;

ALTER TABLE public.saved_quotes
  ADD COLUMN IF NOT EXISTS pricing_version_id UUID REFERENCES public.panel_pricing_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS calculation_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.panel_sizes
SET pricing_version_id = (
  SELECT id FROM public.panel_pricing_versions WHERE is_active = true LIMIT 1
)
WHERE pricing_version_id IS NULL;

UPDATE public.panel_option_surcharges
SET pricing_version_id = (
  SELECT id FROM public.panel_pricing_versions WHERE is_active = true LIMIT 1
)
WHERE pricing_version_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_color_options_producible
  ON public.color_options(panel_master_id, is_active, is_producible);

CREATE INDEX IF NOT EXISTS idx_saved_quotes_pricing_version
  ON public.saved_quotes(pricing_version_id);

COMMENT ON TABLE public.panel_pricing_versions IS '원판/옵션 단가표 버전 관리';
COMMENT ON COLUMN public.saved_quotes.calculation_snapshot IS '견적 저장 당시 계산 근거 및 품목별 breakdown 스냅샷';
COMMENT ON COLUMN public.color_options.is_producible IS '해당 컬러의 생산 가능 여부';
COMMENT ON COLUMN public.color_options.is_bright_pigment IS '브라이트/스리/진백 등 흰색 안료 추가 컬러 여부';
