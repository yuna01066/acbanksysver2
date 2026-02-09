
-- Add mentioned_user_ids to track tagged employees
ALTER TABLE public.project_updates
  ADD COLUMN IF NOT EXISTS mentioned_user_ids UUID[] DEFAULT '{}';
