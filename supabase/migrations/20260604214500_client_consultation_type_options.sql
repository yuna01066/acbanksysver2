ALTER TABLE public.client_consultation_leads
  ADD COLUMN IF NOT EXISTS consultation_type TEXT NOT NULL DEFAULT 'fabrication';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_consultation_leads_consultation_type_check'
      AND conrelid = 'public.client_consultation_leads'::regclass
  ) THEN
    ALTER TABLE public.client_consultation_leads
      ADD CONSTRAINT client_consultation_leads_consultation_type_check
      CHECK (consultation_type IN ('sheet_purchase', 'fabrication', 'design'));
  END IF;
END $$;

ALTER TABLE public.client_consultation_items
  ADD COLUMN IF NOT EXISTS material_quality_id TEXT,
  ADD COLUMN IF NOT EXISTS material_name TEXT,
  ADD COLUMN IF NOT EXISTS color_option_id TEXT,
  ADD COLUMN IF NOT EXISTS color_code TEXT,
  ADD COLUMN IF NOT EXISTS sheet_size TEXT;

CREATE INDEX IF NOT EXISTS idx_client_consultation_leads_type_status
  ON public.client_consultation_leads(consultation_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_consultation_items_material
  ON public.client_consultation_items(material_quality_id)
  WHERE material_quality_id IS NOT NULL;

COMMENT ON COLUMN public.client_consultation_leads.consultation_type IS 'Client consultation category: sheet purchase, fabrication, or design.';
COMMENT ON COLUMN public.client_consultation_items.material_quality_id IS 'Calculator material/quality id selected in the client consultation widget.';
COMMENT ON COLUMN public.client_consultation_items.sheet_size IS 'Panel size selected for sheet purchase inquiries.';
