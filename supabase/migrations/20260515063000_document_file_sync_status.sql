ALTER TABLE public.document_files
  ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sync_error TEXT,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'document_files_sync_status_check'
  ) THEN
    ALTER TABLE public.document_files
      ADD CONSTRAINT document_files_sync_status_check
      CHECK (sync_status IN ('pending', 'synced', 'failed', 'not_required'));
  END IF;
END $$;

UPDATE public.document_files
SET sync_status = CASE
    WHEN drive_file_id IS NOT NULL THEN 'synced'
    WHEN storage_provider IN ('google_drive', 'external_url') THEN 'synced'
    ELSE sync_status
  END,
  synced_at = CASE
    WHEN drive_file_id IS NOT NULL AND synced_at IS NULL THEN updated_at
    ELSE synced_at
  END
WHERE sync_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_document_files_sync_status
ON public.document_files(sync_status);
