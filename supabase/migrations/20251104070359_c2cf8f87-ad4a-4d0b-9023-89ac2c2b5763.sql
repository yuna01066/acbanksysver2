-- Add slot7, slot8, slot9, slot10 to processing_option_type enum for future extensibility
ALTER TYPE processing_option_type ADD VALUE IF NOT EXISTS 'slot7';
ALTER TYPE processing_option_type ADD VALUE IF NOT EXISTS 'slot8';
ALTER TYPE processing_option_type ADD VALUE IF NOT EXISTS 'slot9';
ALTER TYPE processing_option_type ADD VALUE IF NOT EXISTS 'slot10';