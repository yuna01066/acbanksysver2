
-- Create a table for role-based page access
CREATE TABLE public.page_role_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL UNIQUE,
  min_role text NOT NULL DEFAULT 'employee',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.page_role_access ENABLE ROW LEVEL SECURITY;

-- Only admins can manage
CREATE POLICY "Admins can manage page role access"
  ON public.page_role_access FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- All authenticated users can read (needed for the guard check)
CREATE POLICY "Authenticated users can read page role access"
  ON public.page_role_access FOR SELECT
  TO authenticated
  USING (true);
