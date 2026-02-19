
-- Store OAuth tokens for Imweb Ground API
CREATE TABLE public.imweb_oauth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Only admins can manage tokens
ALTER TABLE public.imweb_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage imweb tokens"
  ON public.imweb_oauth_tokens
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
