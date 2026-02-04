-- Add pluuug sync status columns to saved_quotes table
ALTER TABLE public.saved_quotes 
ADD COLUMN IF NOT EXISTS pluuug_synced boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pluuug_synced_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS pluuug_estimate_id text;