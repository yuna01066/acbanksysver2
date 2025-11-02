-- 1. panel_sizes 테이블에 price 컬럼 추가
ALTER TABLE public.panel_sizes
ADD COLUMN price NUMERIC;

-- 2. panel_prices 데이터를 panel_sizes로 마이그레이션
UPDATE public.panel_sizes ps
SET price = pp.price
FROM public.panel_prices pp
WHERE ps.id = pp.panel_size_id;

-- 3. panel_prices 테이블 삭제 (더 이상 필요 없음)
DROP TABLE IF EXISTS public.panel_prices;

-- 4. 컬러 옵션 테이블 생성
CREATE TABLE public.color_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_master_id UUID NOT NULL REFERENCES public.panel_masters(id) ON DELETE CASCADE,
  color_name TEXT NOT NULL,
  color_code TEXT,  -- HEX 코드 등
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.color_options ENABLE ROW LEVEL SECURITY;

-- 누구나 읽을 수 있음
CREATE POLICY "Anyone can read color options"
  ON public.color_options
  FOR SELECT
  USING (true);

-- 인증된 사용자만 관리 가능
CREATE POLICY "Authenticated users can manage color options"
  ON public.color_options
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- 업데이트 트리거
CREATE TRIGGER update_color_options_updated_at
  BEFORE UPDATE ON public.color_options
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 인덱스 추가
CREATE INDEX idx_color_options_panel_master ON public.color_options(panel_master_id);
CREATE INDEX idx_color_options_active ON public.color_options(is_active);

-- 5. panel_sizes 테이블에 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_panel_sizes_active ON public.panel_sizes(is_active);
CREATE INDEX IF NOT EXISTS idx_panel_sizes_panel_master ON public.panel_sizes(panel_master_id);

COMMENT ON TABLE public.color_options IS '재질별 컬러 옵션 관리';
COMMENT ON COLUMN public.panel_sizes.price IS '원판 가격 (통합됨)';