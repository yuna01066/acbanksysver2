
-- 1. 견적서 버전 관리 테이블
CREATE TABLE public.quote_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.saved_quotes(id) ON DELETE CASCADE,
  version_number INT NOT NULL DEFAULT 1,
  snapshot JSONB NOT NULL,
  change_summary TEXT,
  changed_by UUID NOT NULL,
  changed_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_versions_quote_id ON public.quote_versions(quote_id);
CREATE INDEX idx_quote_versions_created_at ON public.quote_versions(created_at DESC);

ALTER TABLE public.quote_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view quote versions"
  ON public.quote_versions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert quote versions"
  ON public.quote_versions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 2. 견적서 상태 변경 이력 테이블
CREATE TABLE public.quote_stage_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.saved_quotes(id) ON DELETE CASCADE,
  old_stage TEXT,
  new_stage TEXT NOT NULL,
  changed_by UUID NOT NULL,
  changed_by_name TEXT NOT NULL,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_stage_history_quote_id ON public.quote_stage_history(quote_id);

ALTER TABLE public.quote_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view stage history"
  ON public.quote_stage_history FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert stage history"
  ON public.quote_stage_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
