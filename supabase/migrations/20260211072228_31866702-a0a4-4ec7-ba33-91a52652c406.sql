
-- Add business_name (사업자명) field
ALTER TABLE public.recipients ADD COLUMN business_name text NULL;

-- Add accounting contact fields (회계 담당자)
ALTER TABLE public.recipients ADD COLUMN accounting_contact_person text NULL;
ALTER TABLE public.recipients ADD COLUMN accounting_position text NULL;
ALTER TABLE public.recipients ADD COLUMN accounting_phone text NULL;
ALTER TABLE public.recipients ADD COLUMN accounting_email text NULL;
