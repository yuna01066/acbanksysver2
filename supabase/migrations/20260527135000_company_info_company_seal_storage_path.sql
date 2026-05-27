-- Ensure company seal storage path exists for electronic contract authoring.

ALTER TABLE public.company_info
  ADD COLUMN IF NOT EXISTS company_seal_storage_path TEXT;

COMMENT ON COLUMN public.company_info.company_seal_storage_path
  IS 'Supabase Storage path for the company seal image used in electronic contracts.';

NOTIFY pgrst, 'reload schema';
