-- saved_quotes 테이블에 커스텀 색상 정보 필드 추가
ALTER TABLE saved_quotes 
ADD COLUMN IF NOT EXISTS custom_color_name TEXT,
ADD COLUMN IF NOT EXISTS custom_opacity TEXT;