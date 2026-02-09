-- Create table for review cycle targets (which employees are reviewable per cycle)
CREATE TABLE public.review_cycle_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cycle_id UUID NOT NULL REFERENCES public.performance_review_cycles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cycle_id, user_id)
);

-- Enable RLS
ALTER TABLE public.review_cycle_targets ENABLE ROW LEVEL SECURITY;

-- Admins and moderators can manage targets
CREATE POLICY "Admins and moderators can manage review targets"
ON public.review_cycle_targets
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'moderator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'moderator')
  )
);

-- All authenticated users can read targets (to know who they can review)
CREATE POLICY "Authenticated users can read review targets"
ON public.review_cycle_targets
FOR SELECT
TO authenticated
USING (true);
