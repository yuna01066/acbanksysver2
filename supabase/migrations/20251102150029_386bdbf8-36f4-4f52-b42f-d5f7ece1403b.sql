-- 기존 processing_option_type enum에 새 값만 추가
ALTER TYPE processing_option_type ADD VALUE IF NOT EXISTS 'slot1';
ALTER TYPE processing_option_type ADD VALUE IF NOT EXISTS 'slot2';
ALTER TYPE processing_option_type ADD VALUE IF NOT EXISTS 'slot3';
ALTER TYPE processing_option_type ADD VALUE IF NOT EXISTS 'slot4';