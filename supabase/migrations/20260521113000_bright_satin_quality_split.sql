-- Bright and Satin are separate material/quality selections.
ALTER TYPE public.panel_quality ADD VALUE IF NOT EXISTS 'bright-color';
ALTER TYPE public.panel_quality ADD VALUE IF NOT EXISTS 'satin-mirror';
