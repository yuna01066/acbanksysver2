-- Store latest Channel Talk text metadata on leads and prevent duplicate
-- notification rows per active Channel Talk inquiry.

ALTER TABLE public.channel_talk_quote_leads
  ADD COLUMN IF NOT EXISTS last_message_text TEXT,
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_channel_talk_message_id TEXT;

ALTER TABLE public.channel_talk_quote_leads
  ADD COLUMN IF NOT EXISTS message_count INTEGER;

ALTER TABLE public.channel_talk_quote_leads
  ALTER COLUMN message_count SET DEFAULT 0;

UPDATE public.channel_talk_quote_leads
SET message_count = 0
WHERE message_count IS NULL;

ALTER TABLE public.channel_talk_quote_leads
  ALTER COLUMN message_count SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_channel_talk_quote_leads_active_user_chat
  ON public.channel_talk_quote_leads(channel_talk_user_chat_id, updated_at DESC)
  WHERE status IN ('new', 'needs_review', 'reply_draft', 'waiting_customer', 'analyzed', 'on_hold');

WITH latest_customer_message AS (
  SELECT DISTINCT ON (lead_id)
    lead_id,
    body,
    received_at,
    message_id
  FROM public.channel_talk_messages
  WHERE lead_id IS NOT NULL
    AND sender_type = 'user'
  ORDER BY lead_id, received_at DESC
),
customer_message_counts AS (
  SELECT
    lead_id,
    count(*)::integer AS message_count
  FROM public.channel_talk_messages
  WHERE lead_id IS NOT NULL
    AND sender_type = 'user'
  GROUP BY lead_id
)
UPDATE public.channel_talk_quote_leads lead
SET
  last_message_text = COALESCE(lead.last_message_text, latest.body),
  last_message_at = COALESCE(lead.last_message_at, latest.received_at),
  last_channel_talk_message_id = COALESCE(lead.last_channel_talk_message_id, latest.message_id),
  message_count = GREATEST(lead.message_count, counts.message_count)
FROM customer_message_counts counts
LEFT JOIN latest_customer_message latest ON latest.lead_id = counts.lead_id
WHERE lead.id = counts.lead_id;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

WITH ranked_channel_talk_notifications AS (
  SELECT
    id,
    'channel-talk-lead:' || (data->>'lead_id') AS next_dedupe_key,
    row_number() OVER (
      PARTITION BY user_id, type, data->>'lead_id'
      ORDER BY created_at DESC, id DESC
    ) AS duplicate_rank
  FROM public.notifications
  WHERE type = 'channel_talk_quote_lead'
    AND data ? 'lead_id'
    AND data->>'lead_id' IS NOT NULL
)
DELETE FROM public.notifications notification
USING ranked_channel_talk_notifications ranked
WHERE notification.id = ranked.id
  AND ranked.duplicate_rank > 1;

WITH channel_talk_notification_keys AS (
  SELECT
    id,
    'channel-talk-lead:' || (data->>'lead_id') AS next_dedupe_key
  FROM public.notifications
  WHERE type = 'channel_talk_quote_lead'
    AND data ? 'lead_id'
    AND data->>'lead_id' IS NOT NULL
)
UPDATE public.notifications notification
SET dedupe_key = keys.next_dedupe_key
FROM channel_talk_notification_keys keys
WHERE notification.id = keys.id
  AND notification.dedupe_key IS DISTINCT FROM keys.next_dedupe_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_type_dedupe_key
  ON public.notifications(user_id, type, dedupe_key);

COMMENT ON COLUMN public.channel_talk_quote_leads.last_message_text IS 'Latest customer message text captured from Channel Talk webhook.';
COMMENT ON COLUMN public.channel_talk_quote_leads.last_message_at IS 'Timestamp of the latest customer message captured for this lead.';
COMMENT ON COLUMN public.channel_talk_quote_leads.message_count IS 'Customer message count grouped into this active Channel Talk lead.';
COMMENT ON COLUMN public.channel_talk_quote_leads.last_channel_talk_message_id IS 'Latest Channel Talk message id captured for this lead.';
COMMENT ON COLUMN public.notifications.dedupe_key IS 'Optional stable key used to keep one notification per user/type/business object.';
