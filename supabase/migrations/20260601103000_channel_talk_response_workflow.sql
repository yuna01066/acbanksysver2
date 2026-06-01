ALTER TABLE public.channel_talk_quote_leads
  ADD COLUMN IF NOT EXISTS channel_talk_event_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.channel_talk_quote_leads
    WHERE channel_talk_event_id IS NOT NULL
    GROUP BY channel_talk_event_id
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_talk_quote_leads_event_unique
      ON public.channel_talk_quote_leads(channel_talk_event_id)
      WHERE channel_talk_event_id IS NOT NULL;
  ELSE
    CREATE INDEX IF NOT EXISTS idx_channel_talk_quote_leads_event_lookup
      ON public.channel_talk_quote_leads(channel_talk_event_id)
      WHERE channel_talk_event_id IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.channel_talk_quote_leads
    WHERE channel_talk_message_id IS NOT NULL
    GROUP BY channel_talk_user_chat_id, channel_talk_message_id
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_talk_quote_leads_chat_message_unique
      ON public.channel_talk_quote_leads(channel_talk_user_chat_id, channel_talk_message_id)
      WHERE channel_talk_message_id IS NOT NULL;
  ELSE
    CREATE INDEX IF NOT EXISTS idx_channel_talk_quote_leads_chat_message_lookup
      ON public.channel_talk_quote_leads(channel_talk_user_chat_id, channel_talk_message_id)
      WHERE channel_talk_message_id IS NOT NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.can_access_channel_talk_inbox(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profile_directory pd
    WHERE pd.id = _user_id
      AND pd.is_approved IS TRUE
      AND (
        public.has_role(_user_id, 'admin'::public.app_role)
        OR public.has_role(_user_id, 'moderator'::public.app_role)
        OR public.has_role(_user_id, 'manager'::public.app_role)
        OR public.has_role(_user_id, 'employee'::public.app_role)
        OR public.has_role(_user_id, 'user'::public.app_role)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_channel_talk_inbox(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_channel_talk_inbox(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_channel_talk_inbox(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_channel_talk_lead(_lead_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.channel_talk_quote_leads lead
    WHERE lead.id = _lead_id
      AND public.can_access_channel_talk_inbox(_user_id)
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_channel_talk_lead(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_channel_talk_lead(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_manage_channel_talk_lead(UUID, UUID) TO authenticated;

ALTER TABLE public.channel_talk_quote_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and moderators can view channel talk quote leads" ON public.channel_talk_quote_leads;
DROP POLICY IF EXISTS "Admins and moderators can update channel talk quote leads" ON public.channel_talk_quote_leads;
DROP POLICY IF EXISTS "Managers can view assigned channel talk quote leads" ON public.channel_talk_quote_leads;
DROP POLICY IF EXISTS "Approved employees can view channel talk quote leads" ON public.channel_talk_quote_leads;
CREATE POLICY "Approved employees can view channel talk quote leads"
ON public.channel_talk_quote_leads FOR SELECT TO authenticated
USING (
  public.can_access_channel_talk_inbox((select auth.uid()))
);

DROP POLICY IF EXISTS "Approved employees can update channel talk quote leads" ON public.channel_talk_quote_leads;
CREATE POLICY "Approved employees can update channel talk quote leads"
ON public.channel_talk_quote_leads FOR UPDATE TO authenticated
USING (
  public.can_access_channel_talk_inbox((select auth.uid()))
)
WITH CHECK (
  public.can_access_channel_talk_inbox((select auth.uid()))
);

CREATE TABLE IF NOT EXISTS public.channel_talk_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.channel_talk_quote_leads(id) ON DELETE SET NULL,
  user_chat_id TEXT NOT NULL,
  message_id TEXT,
  event_id TEXT,
  sender_type TEXT NOT NULL DEFAULT 'unknown'
    CHECK (sender_type IN ('user', 'manager', 'bot', 'system', 'unknown')),
  message_type TEXT NOT NULL DEFAULT 'text',
  body TEXT,
  file_keys TEXT[] NOT NULL DEFAULT '{}',
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT channel_talk_messages_chat_message_unique UNIQUE (user_chat_id, message_id),
  CONSTRAINT channel_talk_messages_event_unique UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_talk_messages_lead_received_at
  ON public.channel_talk_messages(lead_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_channel_talk_messages_user_chat_received_at
  ON public.channel_talk_messages(user_chat_id, received_at DESC);

CREATE TABLE IF NOT EXISTS public.channel_talk_reply_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.channel_talk_quote_leads(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'reviewed', 'sent', 'discarded')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  channel_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_talk_reply_drafts
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_channel_talk_reply_drafts_lead_created_at
  ON public.channel_talk_reply_drafts(lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_channel_talk_reply_drafts_created_by
  ON public.channel_talk_reply_drafts(created_by);

CREATE TABLE IF NOT EXISTS public.channel_talk_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.channel_talk_quote_leads(id) ON DELETE SET NULL,
  action TEXT NOT NULL
    CHECK (action IN ('send_private_note', 'send_customer_reply', 'refresh_messages', 'mark_lead_closed')),
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_name TEXT,
  visible_sender_name TEXT,
  channel_message_id TEXT,
  status TEXT NOT NULL
    CHECK (status IN ('success', 'failed')),
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_talk_action_logs
  ADD COLUMN IF NOT EXISTS sender_name TEXT,
  ADD COLUMN IF NOT EXISTS visible_sender_name TEXT,
  ADD COLUMN IF NOT EXISTS channel_message_id TEXT;

CREATE INDEX IF NOT EXISTS idx_channel_talk_action_logs_lead_created_at
  ON public.channel_talk_action_logs(lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_channel_talk_action_logs_requested_by
  ON public.channel_talk_action_logs(requested_by, created_at DESC);

ALTER TABLE public.channel_talk_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_talk_reply_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_talk_action_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read channel talk messages" ON public.channel_talk_messages;
CREATE POLICY "Users can read channel talk messages"
ON public.channel_talk_messages FOR SELECT TO authenticated
USING (
  public.can_manage_channel_talk_lead(lead_id, (select auth.uid()))
);

DROP POLICY IF EXISTS "Users can insert channel talk messages" ON public.channel_talk_messages;
CREATE POLICY "Users can insert channel talk messages"
ON public.channel_talk_messages FOR INSERT TO authenticated
WITH CHECK (
  public.can_manage_channel_talk_lead(lead_id, (select auth.uid()))
);

DROP POLICY IF EXISTS "Users can read channel talk reply drafts" ON public.channel_talk_reply_drafts;
CREATE POLICY "Users can read channel talk reply drafts"
ON public.channel_talk_reply_drafts FOR SELECT TO authenticated
USING (
  public.can_manage_channel_talk_lead(lead_id, (select auth.uid()))
);

DROP POLICY IF EXISTS "Users can create channel talk reply drafts" ON public.channel_talk_reply_drafts;
CREATE POLICY "Users can create channel talk reply drafts"
ON public.channel_talk_reply_drafts FOR INSERT TO authenticated
WITH CHECK (
  created_by = (select auth.uid())
  AND public.can_manage_channel_talk_lead(lead_id, (select auth.uid()))
);

DROP POLICY IF EXISTS "Users can update channel talk reply drafts" ON public.channel_talk_reply_drafts;
CREATE POLICY "Users can update channel talk reply drafts"
ON public.channel_talk_reply_drafts FOR UPDATE TO authenticated
USING (
  created_by = (select auth.uid())
  OR public.can_manage_channel_talk_lead(lead_id, (select auth.uid()))
)
WITH CHECK (
  updated_by = (select auth.uid())
  OR created_by = (select auth.uid())
  OR public.can_manage_channel_talk_lead(lead_id, (select auth.uid()))
);

DROP POLICY IF EXISTS "Users can read channel talk action logs" ON public.channel_talk_action_logs;
CREATE POLICY "Users can read channel talk action logs"
ON public.channel_talk_action_logs FOR SELECT TO authenticated
USING (
  public.can_manage_channel_talk_lead(lead_id, (select auth.uid()))
);

DROP TRIGGER IF EXISTS update_channel_talk_messages_updated_at ON public.channel_talk_messages;
CREATE TRIGGER update_channel_talk_messages_updated_at
BEFORE UPDATE ON public.channel_talk_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_channel_talk_reply_drafts_updated_at ON public.channel_talk_reply_drafts;
CREATE TRIGGER update_channel_talk_reply_drafts_updated_at
BEFORE UPDATE ON public.channel_talk_reply_drafts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.channel_talk_messages IS 'Channel Talk message ledger synchronized from webhooks or Open API refresh.';
COMMENT ON TABLE public.channel_talk_reply_drafts IS 'Staff-reviewed Channel Talk customer reply drafts.';
COMMENT ON TABLE public.channel_talk_action_logs IS 'Auditable Channel Talk action results from internal system.';

NOTIFY pgrst, 'reload schema';
