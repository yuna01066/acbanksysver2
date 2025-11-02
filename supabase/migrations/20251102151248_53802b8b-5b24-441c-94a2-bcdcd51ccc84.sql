-- processing_option_category enum 생성
DO $$ BEGIN
    CREATE TYPE processing_option_category AS ENUM ('raw', 'simple', 'complex', 'full', 'adhesion', 'additional');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- processing_options 테이블에 category 컬럼 추가
ALTER TABLE processing_options 
ADD COLUMN IF NOT EXISTS category processing_option_category DEFAULT 'additional';

-- 기존 데이터 마이그레이션
-- slot1 -> raw
UPDATE processing_options 
SET category = 'raw'
WHERE option_type = 'slot1';

-- slot2 -> simple (기본값, 나중에 수동으로 조정 가능)
UPDATE processing_options 
SET category = 'simple'
WHERE option_type = 'slot2';

-- slot3 -> adhesion
UPDATE processing_options 
SET category = 'adhesion'
WHERE option_type = 'slot3';

-- additional은 그대로
UPDATE processing_options 
SET category = 'additional'
WHERE option_type = 'additional';

-- category별 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_processing_options_category 
ON processing_options(category);