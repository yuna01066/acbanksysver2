
-- Projects table
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  recipient_id uuid REFERENCES public.recipients(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS: users see own, admins/moderators see all
CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all projects"
  ON public.projects FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can view all projects"
  ON public.projects FOR SELECT
  USING (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Users can create their own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all projects"
  ON public.projects FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can manage all projects"
  ON public.projects FOR ALL
  USING (has_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- Add project_id to saved_quotes for linking
ALTER TABLE public.saved_quotes
  ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- Trigger for updated_at
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
