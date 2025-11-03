-- 관리자가 모든 견적서를 조회할 수 있도록 SELECT 정책 추가
CREATE POLICY "Admins can view all quotes" 
ON public.saved_quotes 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));