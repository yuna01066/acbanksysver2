-- processing_options 테이블에 적용 가능한 두께 컬럼 추가
ALTER TABLE public.processing_options 
ADD COLUMN applicable_thicknesses TEXT[] DEFAULT NULL;

-- 기존 데이터에 기본값 설정 (모든 두께 허용)
UPDATE public.processing_options 
SET applicable_thicknesses = ARRAY['3T', '5T', '6T', '8T', '10T', '12T', '15T', '18T', '20T']
WHERE applicable_thicknesses IS NULL;