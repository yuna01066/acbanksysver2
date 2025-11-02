-- 가공 옵션 타입 enum 생성
CREATE TYPE processing_option_type AS ENUM (
  'additional',  -- 추가 옵션 (엣지, 불광, 타공, 무광)
  'processing',  -- 가공 방식
  'adhesion'     -- 접착 방식
);

-- 가공 옵션 테이블 생성
CREATE TABLE public.processing_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_type processing_option_type NOT NULL,
  option_id TEXT NOT NULL UNIQUE,  -- 'edgeFinishing', 'bulgwang', 'tapung', 'mugwangPainting' 등
  name TEXT NOT NULL,  -- 표시 이름
  description TEXT,
  multiplier NUMERIC,  -- 배수 (원판금액 기준)
  base_cost NUMERIC,   -- 기본 비용 (고정 비용인 경우)
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.processing_options ENABLE ROW LEVEL SECURITY;

-- 누구나 읽을 수 있음
CREATE POLICY "Anyone can read processing options"
  ON public.processing_options
  FOR SELECT
  USING (true);

-- 인증된 사용자만 관리 가능 (나중에 admin 역할로 변경 가능)
CREATE POLICY "Authenticated users can manage processing options"
  ON public.processing_options
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- 업데이트 트리거
CREATE TRIGGER update_processing_options_updated_at
  BEFORE UPDATE ON public.processing_options
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 기본 데이터 삽입
INSERT INTO public.processing_options (option_type, option_id, name, description, multiplier, display_order) VALUES
  ('additional', 'edgeFinishing', '엣지 격면 마감', '엣지 연마 및 격면 마감 처리로 깔끔한 마감을 제공합니다', 0.5, 1),
  ('additional', 'bulgwang', '불광 마감', '불광 처리로 고급스러운 질감을 제공합니다', 0.5, 2),
  ('additional', 'tapung', '타공', '타공 처리로 원하는 위치에 구멍을 가공합니다', 0.2, 3),
  ('additional', 'mugwangPainting', '무광 도장', '무광 도장 처리로 부드러운 마감을 제공합니다', 2.0, 4);