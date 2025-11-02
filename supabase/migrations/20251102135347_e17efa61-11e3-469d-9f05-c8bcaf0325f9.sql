-- Add thickness range columns to processing_options table
ALTER TABLE processing_options
ADD COLUMN IF NOT EXISTS min_thickness numeric,
ADD COLUMN IF NOT EXISTS max_thickness numeric,
ADD COLUMN IF NOT EXISTS apply_thickness_factor boolean DEFAULT true;

COMMENT ON COLUMN processing_options.min_thickness IS '최소 적용 두께 (T 단위, 예: 3)';
COMMENT ON COLUMN processing_options.max_thickness IS '최대 적용 두께 (T 단위, 예: 10)';
COMMENT ON COLUMN processing_options.apply_thickness_factor IS '두께계수 적용 여부 (false일 경우 배수만 적용)';

-- Update existing records to not apply thickness factor for specific options
UPDATE processing_options
SET apply_thickness_factor = false,
    min_thickness = CASE
        WHEN option_id LIKE 'laser%' THEN 1
        WHEN option_id LIKE 'cnc%' THEN 10
        ELSE NULL
    END,
    max_thickness = CASE
        WHEN option_id LIKE 'laser%' THEN 10
        WHEN option_id LIKE 'cnc%' THEN 30
        ELSE NULL
    END
WHERE option_id IN ('laser-simple', 'laser-complex', 'cnc-simple', 'cnc-complex', 'laser-full', 'cnc-full');