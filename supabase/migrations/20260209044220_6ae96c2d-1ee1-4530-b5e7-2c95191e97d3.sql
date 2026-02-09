-- Add additional salary/wage columns to employment_contracts
ALTER TABLE public.employment_contracts
ADD COLUMN IF NOT EXISTS wage_start_date date,
ADD COLUMN IF NOT EXISTS wage_basis text DEFAULT '통상임금',
ADD COLUMN IF NOT EXISTS comprehensive_wage_type text DEFAULT '미포함',
ADD COLUMN IF NOT EXISTS comprehensive_wage_basis text,
ADD COLUMN IF NOT EXISTS comprehensive_wage_hours numeric;
