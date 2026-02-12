
-- Add client/recipient and assignees columns to announcements
ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES public.recipients(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS recipient_name text,
ADD COLUMN IF NOT EXISTS assignee_ids uuid[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS assignee_names text[] DEFAULT '{}';
