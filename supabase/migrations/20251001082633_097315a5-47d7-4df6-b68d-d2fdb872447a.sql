-- Add new quality types to panel_quality enum
ALTER TYPE panel_quality ADD VALUE IF NOT EXISTS 'acrylic-mirror';
ALTER TYPE panel_quality ADD VALUE IF NOT EXISTS 'astel-mirror';