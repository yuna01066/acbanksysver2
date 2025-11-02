-- 카테고리별 로직 구성을 저장하는 테이블 생성
CREATE TABLE public.category_logic_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  slot_key TEXT NOT NULL,
  slot_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(category, slot_order)
);

-- RLS 활성화
ALTER TABLE public.category_logic_slots ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능
CREATE POLICY "Anyone can read category logic slots" 
ON public.category_logic_slots 
FOR SELECT 
USING (true);

-- 누구나 관리 가능 (인증된 사용자만 쓰기 가능하도록 나중에 변경 가능)
CREATE POLICY "Anyone can manage category logic slots" 
ON public.category_logic_slots 
FOR ALL 
USING (true)
WITH CHECK (true);

-- 업데이트 트리거 추가
CREATE TRIGGER update_category_logic_slots_updated_at
BEFORE UPDATE ON public.category_logic_slots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();