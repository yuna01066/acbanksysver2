CREATE TABLE IF NOT EXISTS public.channel_talk_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_chat_id TEXT NOT NULL UNIQUE,
  channel_talk_user_id TEXT,
  customer_name TEXT,
  customer_company TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'waiting_customer', 'on_hold', 'closed')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  memo TEXT,
  close_reason TEXT,
  last_message_at TIMESTAMPTZ,
  last_customer_message_at TIMESTAMPTZ,
  last_staff_reply_at TIMESTAMPTZ,
  latest_lead_id UUID REFERENCES public.channel_talk_quote_leads(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.channel_talk_conversation_reads (
  conversation_id UUID NOT NULL REFERENCES public.channel_talk_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE public.channel_talk_quote_leads
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.channel_talk_conversations(id) ON DELETE SET NULL;

ALTER TABLE public.channel_talk_messages
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.channel_talk_conversations(id) ON DELETE SET NULL;

ALTER TABLE public.channel_talk_reply_drafts
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.channel_talk_conversations(id) ON DELETE SET NULL;

ALTER TABLE public.channel_talk_action_logs
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.channel_talk_conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_channel_talk_conversations_status_last_message
  ON public.channel_talk_conversations(status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_channel_talk_conversations_assigned_to
  ON public.channel_talk_conversations(assigned_to);

CREATE INDEX IF NOT EXISTS idx_channel_talk_conversations_contact
  ON public.channel_talk_conversations(customer_phone, customer_email);

CREATE INDEX IF NOT EXISTS idx_channel_talk_leads_conversation_id
  ON public.channel_talk_quote_leads(conversation_id);

CREATE INDEX IF NOT EXISTS idx_channel_talk_messages_conversation_received_at
  ON public.channel_talk_messages(conversation_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_channel_talk_reply_drafts_conversation_created_at
  ON public.channel_talk_reply_drafts(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_channel_talk_action_logs_conversation_created_at
  ON public.channel_talk_action_logs(conversation_id, created_at DESC);

WITH latest_leads AS (
  SELECT DISTINCT ON (channel_talk_user_chat_id)
    channel_talk_user_chat_id,
    channel_talk_user_id,
    customer_name,
    customer_company,
    customer_phone,
    customer_email,
    status,
    assigned_to,
    memo,
    closed_at,
    created_at,
    updated_at
  FROM public.channel_talk_quote_leads
  WHERE channel_talk_user_chat_id IS NOT NULL
  ORDER BY channel_talk_user_chat_id, updated_at DESC NULLS LAST, created_at DESC
),
message_rollup AS (
  SELECT
    user_chat_id,
    max(received_at) AS last_message_at,
    max(received_at) FILTER (WHERE sender_type = 'user') AS last_customer_message_at,
    max(received_at) FILTER (
      WHERE sender_type <> 'user'
        AND message_type <> 'private_note'
    ) AS last_staff_reply_at
  FROM public.channel_talk_messages
  WHERE user_chat_id IS NOT NULL
  GROUP BY user_chat_id
)
INSERT INTO public.channel_talk_conversations (
  user_chat_id,
  channel_talk_user_id,
  customer_name,
  customer_company,
  customer_phone,
  customer_email,
  status,
  assigned_to,
  assigned_at,
  memo,
  closed_at,
  last_message_at,
  last_customer_message_at,
  last_staff_reply_at,
  created_at,
  updated_at
)
SELECT
  latest.channel_talk_user_chat_id,
  latest.channel_talk_user_id,
  latest.customer_name,
  latest.customer_company,
  latest.customer_phone,
  latest.customer_email,
  CASE
    WHEN latest.status IN ('closed', 'converted') THEN 'closed'
    WHEN latest.status = 'waiting_customer' THEN 'waiting_customer'
    WHEN latest.status = 'on_hold' THEN 'on_hold'
    ELSE 'active'
  END,
  latest.assigned_to,
  CASE WHEN latest.assigned_to IS NOT NULL THEN latest.updated_at ELSE NULL END,
  latest.memo,
  latest.closed_at,
  COALESCE(message_rollup.last_message_at, latest.updated_at, latest.created_at),
  message_rollup.last_customer_message_at,
  message_rollup.last_staff_reply_at,
  latest.created_at,
  COALESCE(latest.updated_at, latest.created_at)
FROM latest_leads latest
LEFT JOIN message_rollup ON message_rollup.user_chat_id = latest.channel_talk_user_chat_id
ON CONFLICT (user_chat_id) DO UPDATE SET
  channel_talk_user_id = COALESCE(EXCLUDED.channel_talk_user_id, channel_talk_conversations.channel_talk_user_id),
  customer_name = COALESCE(EXCLUDED.customer_name, channel_talk_conversations.customer_name),
  customer_company = COALESCE(EXCLUDED.customer_company, channel_talk_conversations.customer_company),
  customer_phone = COALESCE(EXCLUDED.customer_phone, channel_talk_conversations.customer_phone),
  customer_email = COALESCE(EXCLUDED.customer_email, channel_talk_conversations.customer_email),
  last_message_at = GREATEST(
    COALESCE(channel_talk_conversations.last_message_at, '-infinity'::timestamptz),
    COALESCE(EXCLUDED.last_message_at, '-infinity'::timestamptz)
  ),
  last_customer_message_at = GREATEST(
    COALESCE(channel_talk_conversations.last_customer_message_at, '-infinity'::timestamptz),
    COALESCE(EXCLUDED.last_customer_message_at, '-infinity'::timestamptz)
  ),
  last_staff_reply_at = GREATEST(
    COALESCE(channel_talk_conversations.last_staff_reply_at, '-infinity'::timestamptz),
    COALESCE(EXCLUDED.last_staff_reply_at, '-infinity'::timestamptz)
  ),
  updated_at = now();

UPDATE public.channel_talk_quote_leads lead
SET conversation_id = conversation.id
FROM public.channel_talk_conversations conversation
WHERE lead.conversation_id IS NULL
  AND lead.channel_talk_user_chat_id = conversation.user_chat_id;

UPDATE public.channel_talk_messages message
SET conversation_id = conversation.id
FROM public.channel_talk_conversations conversation
WHERE message.conversation_id IS NULL
  AND message.user_chat_id = conversation.user_chat_id;

UPDATE public.channel_talk_reply_drafts draft
SET conversation_id = lead.conversation_id
FROM public.channel_talk_quote_leads lead
WHERE draft.conversation_id IS NULL
  AND draft.lead_id = lead.id;

UPDATE public.channel_talk_action_logs log
SET conversation_id = lead.conversation_id
FROM public.channel_talk_quote_leads lead
WHERE log.conversation_id IS NULL
  AND log.lead_id = lead.id;

UPDATE public.channel_talk_conversations conversation
SET latest_lead_id = (
  SELECT lead.id
  FROM public.channel_talk_quote_leads lead
  WHERE lead.conversation_id = conversation.id
  ORDER BY lead.updated_at DESC NULLS LAST, lead.created_at DESC
  LIMIT 1
)
WHERE latest_lead_id IS NULL;

ALTER TABLE public.channel_talk_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_talk_conversation_reads ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_channel_talk_conversation(_conversation_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.channel_talk_conversations conversation
    WHERE conversation.id = _conversation_id
      AND public.can_access_channel_talk_inbox(_user_id)
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_channel_talk_conversation(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_channel_talk_conversation(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_manage_channel_talk_conversation(UUID, UUID) TO authenticated;

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
      AND (
        public.can_access_channel_talk_inbox(_user_id)
        OR public.can_manage_channel_talk_conversation(lead.conversation_id, _user_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_channel_talk_lead(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_channel_talk_lead(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_manage_channel_talk_lead(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "Approved employees can view channel talk conversations" ON public.channel_talk_conversations;
CREATE POLICY "Approved employees can view channel talk conversations"
ON public.channel_talk_conversations FOR SELECT TO authenticated
USING (
  public.can_access_channel_talk_inbox((select auth.uid()))
);

DROP POLICY IF EXISTS "Approved employees can update channel talk conversations" ON public.channel_talk_conversations;
CREATE POLICY "Approved employees can update channel talk conversations"
ON public.channel_talk_conversations FOR UPDATE TO authenticated
USING (
  public.can_access_channel_talk_inbox((select auth.uid()))
)
WITH CHECK (
  public.can_access_channel_talk_inbox((select auth.uid()))
);

DROP POLICY IF EXISTS "Users can read own channel talk conversation reads" ON public.channel_talk_conversation_reads;
CREATE POLICY "Users can read own channel talk conversation reads"
ON public.channel_talk_conversation_reads FOR SELECT TO authenticated
USING (
  user_id = (select auth.uid())
  AND public.can_manage_channel_talk_conversation(conversation_id, (select auth.uid()))
);

DROP POLICY IF EXISTS "Users can create own channel talk conversation reads" ON public.channel_talk_conversation_reads;
CREATE POLICY "Users can create own channel talk conversation reads"
ON public.channel_talk_conversation_reads FOR INSERT TO authenticated
WITH CHECK (
  user_id = (select auth.uid())
  AND public.can_manage_channel_talk_conversation(conversation_id, (select auth.uid()))
);

DROP POLICY IF EXISTS "Users can update own channel talk conversation reads" ON public.channel_talk_conversation_reads;
CREATE POLICY "Users can update own channel talk conversation reads"
ON public.channel_talk_conversation_reads FOR UPDATE TO authenticated
USING (
  user_id = (select auth.uid())
  AND public.can_manage_channel_talk_conversation(conversation_id, (select auth.uid()))
)
WITH CHECK (
  user_id = (select auth.uid())
  AND public.can_manage_channel_talk_conversation(conversation_id, (select auth.uid()))
);

DROP POLICY IF EXISTS "Users can read channel talk messages" ON public.channel_talk_messages;
CREATE POLICY "Users can read channel talk messages"
ON public.channel_talk_messages FOR SELECT TO authenticated
USING (
  public.can_manage_channel_talk_conversation(conversation_id, (select auth.uid()))
  OR public.can_manage_channel_talk_lead(lead_id, (select auth.uid()))
);

DROP POLICY IF EXISTS "Users can insert channel talk messages" ON public.channel_talk_messages;
CREATE POLICY "Users can insert channel talk messages"
ON public.channel_talk_messages FOR INSERT TO authenticated
WITH CHECK (
  public.can_manage_channel_talk_conversation(conversation_id, (select auth.uid()))
  OR public.can_manage_channel_talk_lead(lead_id, (select auth.uid()))
);

DROP POLICY IF EXISTS "Users can read channel talk reply drafts" ON public.channel_talk_reply_drafts;
CREATE POLICY "Users can read channel talk reply drafts"
ON public.channel_talk_reply_drafts FOR SELECT TO authenticated
USING (
  public.can_manage_channel_talk_conversation(conversation_id, (select auth.uid()))
  OR public.can_manage_channel_talk_lead(lead_id, (select auth.uid()))
);

DROP POLICY IF EXISTS "Users can create channel talk reply drafts" ON public.channel_talk_reply_drafts;
CREATE POLICY "Users can create channel talk reply drafts"
ON public.channel_talk_reply_drafts FOR INSERT TO authenticated
WITH CHECK (
  created_by = (select auth.uid())
  AND (
    public.can_manage_channel_talk_conversation(conversation_id, (select auth.uid()))
    OR public.can_manage_channel_talk_lead(lead_id, (select auth.uid()))
  )
);

DROP POLICY IF EXISTS "Users can update channel talk reply drafts" ON public.channel_talk_reply_drafts;
CREATE POLICY "Users can update channel talk reply drafts"
ON public.channel_talk_reply_drafts FOR UPDATE TO authenticated
USING (
  created_by = (select auth.uid())
  OR public.can_manage_channel_talk_conversation(conversation_id, (select auth.uid()))
  OR public.can_manage_channel_talk_lead(lead_id, (select auth.uid()))
)
WITH CHECK (
  updated_by = (select auth.uid())
  OR created_by = (select auth.uid())
  OR public.can_manage_channel_talk_conversation(conversation_id, (select auth.uid()))
  OR public.can_manage_channel_talk_lead(lead_id, (select auth.uid()))
);

DROP POLICY IF EXISTS "Users can read channel talk action logs" ON public.channel_talk_action_logs;
CREATE POLICY "Users can read channel talk action logs"
ON public.channel_talk_action_logs FOR SELECT TO authenticated
USING (
  public.can_manage_channel_talk_conversation(conversation_id, (select auth.uid()))
  OR public.can_manage_channel_talk_lead(lead_id, (select auth.uid()))
);

ALTER TABLE public.channel_talk_action_logs
  DROP CONSTRAINT IF EXISTS channel_talk_action_logs_action_check;

ALTER TABLE public.channel_talk_action_logs
  ADD CONSTRAINT channel_talk_action_logs_action_check
  CHECK (
    action IN (
      'send_private_note',
      'send_customer_reply',
      'refresh_messages',
      'mark_lead_closed',
      'assign_conversation',
      'mark_conversation_read',
      'close_conversation'
    )
  );

DROP TRIGGER IF EXISTS update_channel_talk_conversations_updated_at ON public.channel_talk_conversations;
CREATE TRIGGER update_channel_talk_conversations_updated_at
BEFORE UPDATE ON public.channel_talk_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_channel_talk_conversation_reads_updated_at ON public.channel_talk_conversation_reads;
CREATE TRIGGER update_channel_talk_conversation_reads_updated_at
BEFORE UPDATE ON public.channel_talk_conversation_reads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.channel_talk_conversations IS 'Channel Talk UserChat-based consultation conversation threads.';
COMMENT ON TABLE public.channel_talk_conversation_reads IS 'Per-user read markers for Channel Talk conversations.';
COMMENT ON COLUMN public.channel_talk_quote_leads.conversation_id IS 'Parent Channel Talk conversation thread. Multiple AI leads can belong to one UserChat conversation.';
COMMENT ON COLUMN public.channel_talk_messages.conversation_id IS 'Parent Channel Talk conversation thread for message display.';

NOTIFY pgrst, 'reload schema';
