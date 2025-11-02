-- RLS 정책 수정: 인증 없이도 가공 옵션 관리 가능하도록 변경
DROP POLICY IF EXISTS "Authenticated users can manage processing options" ON processing_options;

CREATE POLICY "Anyone can manage processing options"
ON processing_options
FOR ALL
USING (true)
WITH CHECK (true);