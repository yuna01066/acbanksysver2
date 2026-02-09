
-- Table to store page access permissions per user
CREATE TABLE public.page_access_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_key TEXT NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (page_key, user_id)
);

-- Enable RLS
ALTER TABLE public.page_access_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can fully manage
CREATE POLICY "Admins can manage page access permissions"
  ON public.page_access_permissions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Moderators can read
CREATE POLICY "Moderators can view page access permissions"
  ON public.page_access_permissions
  FOR SELECT
  USING (has_role(auth.uid(), 'moderator'::app_role));

-- Users can read their own permissions
CREATE POLICY "Users can view their own page access"
  ON public.page_access_permissions
  FOR SELECT
  USING (auth.uid() = user_id);
