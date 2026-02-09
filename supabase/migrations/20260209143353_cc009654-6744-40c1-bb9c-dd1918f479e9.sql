-- Add new fields for updated incident report form
ALTER TABLE public.incident_reports
  ADD COLUMN IF NOT EXISTS incident_subject TEXT,
  ADD COLUMN IF NOT EXISTS incident_time TEXT,
  ADD COLUMN IF NOT EXISTS incident_location TEXT;