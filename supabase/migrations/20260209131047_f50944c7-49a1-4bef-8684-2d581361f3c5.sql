
-- Add missing profile fields
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS resident_registration_number text,
ADD COLUMN IF NOT EXISTS group_join_date date,
ADD COLUMN IF NOT EXISTS join_type text,
ADD COLUMN IF NOT EXISTS family_basic_deduction integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS family_child_tax_credit integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS family_health_dependents integer DEFAULT 0;
