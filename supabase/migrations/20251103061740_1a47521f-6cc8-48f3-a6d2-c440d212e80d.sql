-- Add fields for quantity control and multiple selection to processing_options
ALTER TABLE processing_options 
ADD COLUMN IF NOT EXISTS min_quantity integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_quantity integer,
ADD COLUMN IF NOT EXISTS allow_multiple boolean DEFAULT false;

-- Update existing additional and advanced_pricing options to allow multiple selection
UPDATE processing_options 
SET allow_multiple = true 
WHERE option_type IN ('additional', 'advanced_pricing');