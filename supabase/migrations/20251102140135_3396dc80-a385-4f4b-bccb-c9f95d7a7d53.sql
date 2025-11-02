-- Update raw-only option to use 'raw' type
UPDATE processing_options
SET option_type = 'raw'::processing_option_type
WHERE option_id = 'raw-only';

-- Remove thickness factor related columns
ALTER TABLE processing_options
DROP COLUMN IF EXISTS apply_thickness_factor,
DROP COLUMN IF EXISTS min_thickness,
DROP COLUMN IF EXISTS max_thickness;