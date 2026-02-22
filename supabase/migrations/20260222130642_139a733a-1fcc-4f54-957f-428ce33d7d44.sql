
-- Portfolio posts table
CREATE TABLE public.portfolio_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view portfolio posts"
  ON public.portfolio_posts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create portfolio posts"
  ON public.portfolio_posts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update portfolio posts"
  ON public.portfolio_posts FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete portfolio posts"
  ON public.portfolio_posts FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Portfolio images table
CREATE TABLE public.portfolio_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.portfolio_posts(id) ON DELETE CASCADE,
  drive_file_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  thumbnail_url TEXT,
  image_url TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_main BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view portfolio images"
  ON public.portfolio_images FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create portfolio images"
  ON public.portfolio_images FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete portfolio images"
  ON public.portfolio_images FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_portfolio_posts_updated_at
  BEFORE UPDATE ON public.portfolio_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
