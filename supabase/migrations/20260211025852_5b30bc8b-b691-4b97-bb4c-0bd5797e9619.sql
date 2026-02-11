
-- Add meeting-related columns to announcements table
ALTER TABLE public.announcements
  ADD COLUMN announcement_type text NOT NULL DEFAULT 'general',
  ADD COLUMN meeting_date date NULL,
  ADD COLUMN meeting_time text NULL,
  ADD COLUMN meeting_location text NULL;
