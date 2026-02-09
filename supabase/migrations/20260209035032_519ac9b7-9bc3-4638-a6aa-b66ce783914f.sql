-- Add additional employee profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS work_type TEXT,
  ADD COLUMN IF NOT EXISTS work_hours_per_week NUMERIC DEFAULT 40,
  ADD COLUMN IF NOT EXISTS overtime_policy TEXT,
  ADD COLUMN IF NOT EXISTS salary_info TEXT,
  ADD COLUMN IF NOT EXISTS wage_contract TEXT,
  ADD COLUMN IF NOT EXISTS leave_policy TEXT,
  ADD COLUMN IF NOT EXISTS holidays TEXT,
  ADD COLUMN IF NOT EXISTS leave_history TEXT,
  ADD COLUMN IF NOT EXISTS awards TEXT,
  ADD COLUMN IF NOT EXISTS disciplinary TEXT,
  ADD COLUMN IF NOT EXISTS career_history TEXT,
  ADD COLUMN IF NOT EXISTS education TEXT,
  ADD COLUMN IF NOT EXISTS special_notes TEXT,
  ADD COLUMN IF NOT EXISTS family_info TEXT;
