-- Add explicit color series metadata for ACBANK sample-chip color options.
-- Keep enum updates separate from data usage so new enum values are committed before use.
ALTER TYPE public.panel_quality ADD VALUE IF NOT EXISTS 'bright-color';
ALTER TYPE public.panel_quality ADD VALUE IF NOT EXISTS 'satin-mirror';

ALTER TABLE public.color_options
  ADD COLUMN IF NOT EXISTS series_key TEXT,
  ADD COLUMN IF NOT EXISTS pantone TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT;

CREATE INDEX IF NOT EXISTS idx_color_options_series_lookup
  ON public.color_options(panel_master_id, series_key, is_active, is_producible);

CREATE INDEX IF NOT EXISTS idx_color_options_name_series
  ON public.color_options(panel_master_id, color_name, series_key);

COMMENT ON COLUMN public.color_options.series_key IS 'ACBANK color source series such as CLEAR_A, CLEAR_B, BRIGHT_A, SATIN';
COMMENT ON COLUMN public.color_options.pantone IS 'Pantone reference from the latest ACBANK color-code source';
COMMENT ON COLUMN public.color_options.source_url IS 'Public sample-chip product URL used as color reference';
