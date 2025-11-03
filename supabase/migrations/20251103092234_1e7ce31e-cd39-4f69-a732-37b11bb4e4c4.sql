-- Add missing recipient fields to saved_quotes table
ALTER TABLE public.saved_quotes 
ADD COLUMN IF NOT EXISTS project_name text,
ADD COLUMN IF NOT EXISTS quote_date_display timestamp with time zone,
ADD COLUMN IF NOT EXISTS valid_until text,
ADD COLUMN IF NOT EXISTS delivery_period text,
ADD COLUMN IF NOT EXISTS payment_condition text,
ADD COLUMN IF NOT EXISTS desired_delivery_date timestamp with time zone;