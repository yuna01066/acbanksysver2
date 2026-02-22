
-- Add keywords array column to portfolio_posts
ALTER TABLE public.portfolio_posts ADD COLUMN keywords TEXT[] DEFAULT '{}';

-- Drop description column (replaced by keywords)
ALTER TABLE public.portfolio_posts DROP COLUMN IF EXISTS description;
