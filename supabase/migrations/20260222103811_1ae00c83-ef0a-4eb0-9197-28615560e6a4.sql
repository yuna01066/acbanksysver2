
-- 수율 계산 이력 테이블
CREATE TABLE public.yield_calculation_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  title TEXT,
  quality TEXT NOT NULL,
  thickness TEXT NOT NULL,
  cut_items JSONB NOT NULL,
  results JSONB,
  combinations JSONB,
  best_efficiency NUMERIC,
  total_panels_needed INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.yield_calculation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own history"
  ON public.yield_calculation_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own history"
  ON public.yield_calculation_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own history"
  ON public.yield_calculation_history FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_yield_history_user ON public.yield_calculation_history(user_id, created_at DESC);

-- 즐겨찾기 도형 프리셋 테이블
CREATE TABLE public.yield_cut_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  cut_items JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.yield_cut_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own presets"
  ON public.yield_cut_presets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own presets"
  ON public.yield_cut_presets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presets"
  ON public.yield_cut_presets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own presets"
  ON public.yield_cut_presets FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_yield_presets_user ON public.yield_cut_presets(user_id);

-- Updated at trigger for presets
CREATE TRIGGER update_yield_cut_presets_updated_at
  BEFORE UPDATE ON public.yield_cut_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
