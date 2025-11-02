-- 기존 데이터를 새로운 타입으로 마이그레이션
UPDATE processing_options 
SET option_type = 'slot1'::processing_option_type
WHERE option_type = 'raw'::processing_option_type;

UPDATE processing_options 
SET option_type = 'slot2'::processing_option_type
WHERE option_type = 'processing'::processing_option_type;

UPDATE processing_options 
SET option_type = 'slot3'::processing_option_type
WHERE option_type = 'adhesion'::processing_option_type;