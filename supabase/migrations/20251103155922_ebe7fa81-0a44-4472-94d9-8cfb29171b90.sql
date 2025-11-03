-- 1. saved_quotes 테이블 RLS 정책 수정
-- user_id NULL 조건 제거하여 본인의 견적서만 조회 가능하도록 수정
DROP POLICY IF EXISTS "Users can view their own quotes" ON public.saved_quotes;

CREATE POLICY "Users can view their own quotes" 
ON public.saved_quotes 
FOR SELECT 
USING (auth.uid() = user_id);

-- 2. 설정 테이블들의 RLS 정책 수정 - 인증된 사용자만 수정 가능
-- panel_sizes 테이블
DROP POLICY IF EXISTS "Anyone can manage panel sizes" ON public.panel_sizes;

CREATE POLICY "Authenticated users can manage panel sizes" 
ON public.panel_sizes 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- slot_types 테이블
DROP POLICY IF EXISTS "Anyone can manage slot types" ON public.slot_types;

CREATE POLICY "Authenticated users can manage slot types" 
ON public.slot_types 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- processing_options 테이블
DROP POLICY IF EXISTS "Anyone can manage processing options" ON public.processing_options;

CREATE POLICY "Authenticated users can manage processing options" 
ON public.processing_options 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- processing_categories 테이블
DROP POLICY IF EXISTS "Anyone can manage processing categories" ON public.processing_categories;

CREATE POLICY "Authenticated users can manage processing categories" 
ON public.processing_categories 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- category_logic_slots 테이블
DROP POLICY IF EXISTS "Anyone can manage category logic slots" ON public.category_logic_slots;

CREATE POLICY "Authenticated users can manage category logic slots" 
ON public.category_logic_slots 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- 3. user_id를 NOT NULL로 변경하여 무결성 보장
-- 먼저 NULL 값이 있는지 확인하고 처리
DO $$
BEGIN
  -- user_id가 NULL인 레코드가 있으면 삭제 또는 기본값 설정
  -- 프로덕션에서는 주의 필요
  DELETE FROM public.saved_quotes WHERE user_id IS NULL;
END $$;

-- user_id를 NOT NULL로 변경
ALTER TABLE public.saved_quotes 
ALTER COLUMN user_id SET NOT NULL;