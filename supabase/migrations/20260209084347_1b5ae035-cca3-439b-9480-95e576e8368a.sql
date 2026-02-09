
-- Create project_updates table for timeline feed
CREATE TABLE public.project_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  notion_links JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view project updates"
ON public.project_updates FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create project updates"
ON public.project_updates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own updates"
ON public.project_updates FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own updates"
ON public.project_updates FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all project updates"
ON public.project_updates FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can manage all project updates"
ON public.project_updates FOR ALL
USING (has_role(auth.uid(), 'moderator'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_updates;
