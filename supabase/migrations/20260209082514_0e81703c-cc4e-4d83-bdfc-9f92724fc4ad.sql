
-- Add payment_status column to projects table
ALTER TABLE public.projects 
ADD COLUMN payment_status text NOT NULL DEFAULT 'unpaid';
