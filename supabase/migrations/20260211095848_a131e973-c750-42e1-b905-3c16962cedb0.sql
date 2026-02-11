-- Add event_end_date column for event-type announcements (date range support)
ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS event_end_date text NULL;