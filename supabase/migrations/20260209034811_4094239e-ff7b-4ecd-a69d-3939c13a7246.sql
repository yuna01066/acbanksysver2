-- Add additional profile fields for employee information
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employee_number TEXT,
  ADD COLUMN IF NOT EXISTS birthday DATE,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS detail_address TEXT,
  ADD COLUMN IF NOT EXISTS zipcode TEXT,
  ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT '대한민국(KOR)',
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account TEXT,
  ADD COLUMN IF NOT EXISTS join_date DATE,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS job_group TEXT,
  ADD COLUMN IF NOT EXISTS rank_title TEXT,
  ADD COLUMN IF NOT EXISTS rank_level TEXT,
  ADD COLUMN IF NOT EXISTS nickname TEXT,
  ADD COLUMN IF NOT EXISTS personal_email TEXT;
