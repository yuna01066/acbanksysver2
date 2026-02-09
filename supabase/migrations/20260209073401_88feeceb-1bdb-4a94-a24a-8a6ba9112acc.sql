
CREATE TABLE public.quote_memos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.saved_quotes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_memos ENABLE ROW LEVEL SECURITY;

-- Anyone who can view the quote can view memos
CREATE POLICY "Users can view memos on their own quotes"
  ON public.quote_memos FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.saved_quotes sq WHERE sq.id = quote_id AND sq.user_id = auth.uid())
  );

CREATE POLICY "Admins can view all memos"
  ON public.quote_memos FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can view all memos"
  ON public.quote_memos FOR SELECT
  USING (has_role(auth.uid(), 'moderator'::app_role));

-- Authenticated users can insert memos
CREATE POLICY "Authenticated users can insert memos"
  ON public.quote_memos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own memos
CREATE POLICY "Users can delete their own memos"
  ON public.quote_memos FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can delete any memo
CREATE POLICY "Admins can delete any memo"
  ON public.quote_memos FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
