
-- Add contact person fields to projects
ALTER TABLE public.projects 
ADD COLUMN contact_name text DEFAULT NULL,
ADD COLUMN contact_phone text DEFAULT NULL,
ADD COLUMN contact_email text DEFAULT NULL;
