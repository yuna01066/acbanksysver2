-- Step 1: Add new enum value 'raw' to processing_option_type
ALTER TYPE processing_option_type ADD VALUE IF NOT EXISTS 'raw';