
-- Add workplace location columns to company_info
ALTER TABLE public.company_info
  ADD COLUMN IF NOT EXISTS workplace_lat numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS workplace_lng numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS workplace_radius numeric DEFAULT 500;

-- Add location_memo to attendance_records for out-of-office reason
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS location_memo text DEFAULT NULL;
