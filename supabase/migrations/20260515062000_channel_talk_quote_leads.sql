CREATE TABLE public.channel_talk_quote_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_talk_user_chat_id TEXT NOT NULL,
  channel_talk_user_id TEXT,
  channel_talk_message_id TEXT,
  channel_talk_file_keys TEXT[] NOT NULL DEFAULT '{}',
  customer_name TEXT,
  customer_company TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  inquiry_type TEXT NOT NULL DEFAULT 'quote',
  status TEXT NOT NULL DEFAULT 'new',
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  missing_fields TEXT[] NOT NULL DEFAULT '{}',
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_channel_talk_quote_leads_user_chat_id
  ON public.channel_talk_quote_leads(channel_talk_user_chat_id);

CREATE INDEX idx_channel_talk_quote_leads_status_created_at
  ON public.channel_talk_quote_leads(status, created_at DESC);

CREATE INDEX idx_channel_talk_quote_leads_project_id
  ON public.channel_talk_quote_leads(project_id);

ALTER TABLE public.channel_talk_quote_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and moderators can view channel talk quote leads"
ON public.channel_talk_quote_leads
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);

CREATE POLICY "Admins and moderators can update channel talk quote leads"
ON public.channel_talk_quote_leads
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);

CREATE TRIGGER update_channel_talk_quote_leads_updated_at
BEFORE UPDATE ON public.channel_talk_quote_leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
