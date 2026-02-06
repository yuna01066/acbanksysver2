
-- Create password reset requests table
CREATE TABLE public.password_reset_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID
);

-- Enable RLS
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Policies: anyone can insert (unauthenticated users need to submit requests)
CREATE POLICY "Anyone can create password reset requests"
  ON public.password_reset_requests
  FOR INSERT
  WITH CHECK (true);

-- Admins can view all requests
CREATE POLICY "Admins can view all reset requests"
  ON public.password_reset_requests
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update requests
CREATE POLICY "Admins can update reset requests"
  ON public.password_reset_requests
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete requests
CREATE POLICY "Admins can delete reset requests"
  ON public.password_reset_requests
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
