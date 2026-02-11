
-- 1. Drop pluuug_sync_events table
DROP TABLE IF EXISTS public.pluuug_sync_events;

-- 2. Remove pluuug columns from saved_quotes
ALTER TABLE public.saved_quotes
  DROP COLUMN IF EXISTS pluuug_synced,
  DROP COLUMN IF EXISTS pluuug_synced_at,
  DROP COLUMN IF EXISTS pluuug_estimate_id;

-- 3. Remove pluuug columns from recipients
ALTER TABLE public.recipients
  DROP COLUMN IF EXISTS pluuug_client_id,
  DROP COLUMN IF EXISTS pluuug_synced_at;
