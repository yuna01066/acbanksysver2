-- Keep one active Channel Talk lead per userChat and preserve older duplicates as closed history.

CREATE INDEX IF NOT EXISTS idx_channel_talk_quote_leads_active_user_chat_latest
  ON public.channel_talk_quote_leads(
    channel_talk_user_chat_id,
    last_message_at DESC NULLS LAST,
    updated_at DESC,
    created_at DESC
  )
  WHERE status IN ('new', 'needs_review', 'reply_draft', 'waiting_customer', 'analyzed', 'on_hold');

DROP TABLE IF EXISTS pg_temp.channel_talk_lead_merge_map;

CREATE TEMP TABLE channel_talk_lead_merge_map ON COMMIT DROP AS
WITH ranked_active_leads AS (
  SELECT
    lead.id,
    lead.channel_talk_user_chat_id,
    first_value(lead.id) OVER (
      PARTITION BY lead.channel_talk_user_chat_id
      ORDER BY
        lead.last_message_at DESC NULLS LAST,
        lead.updated_at DESC,
        lead.created_at DESC,
        lead.id DESC
    ) AS keeper_id,
    row_number() OVER (
      PARTITION BY lead.channel_talk_user_chat_id
      ORDER BY
        lead.last_message_at DESC NULLS LAST,
        lead.updated_at DESC,
        lead.created_at DESC,
        lead.id DESC
    ) AS row_number
  FROM public.channel_talk_quote_leads lead
  WHERE lead.channel_talk_user_chat_id IS NOT NULL
    AND lead.status IN ('new', 'needs_review', 'reply_draft', 'waiting_customer', 'analyzed', 'on_hold')
)
SELECT
  ranked.id AS duplicate_id,
  ranked.keeper_id,
  ranked.channel_talk_user_chat_id
FROM ranked_active_leads ranked
WHERE ranked.row_number > 1;

DROP TABLE IF EXISTS pg_temp.channel_talk_lead_merge_members;

CREATE TEMP TABLE channel_talk_lead_merge_members ON COMMIT DROP AS
SELECT
  merge_map.keeper_id,
  merge_map.duplicate_id AS lead_id,
  merge_map.channel_talk_user_chat_id
FROM channel_talk_lead_merge_map merge_map
UNION
SELECT DISTINCT
  merge_map.keeper_id,
  merge_map.keeper_id AS lead_id,
  merge_map.channel_talk_user_chat_id
FROM channel_talk_lead_merge_map merge_map;

UPDATE public.channel_talk_messages message
SET lead_id = merge_map.keeper_id
FROM channel_talk_lead_merge_map merge_map
WHERE message.lead_id = merge_map.duplicate_id;

UPDATE public.channel_talk_reply_drafts draft
SET lead_id = merge_map.keeper_id
FROM channel_talk_lead_merge_map merge_map
WHERE draft.lead_id = merge_map.duplicate_id;

UPDATE public.channel_talk_action_logs log
SET lead_id = merge_map.keeper_id
FROM channel_talk_lead_merge_map merge_map
WHERE log.lead_id = merge_map.duplicate_id;

DELETE FROM public.notifications notification
USING channel_talk_lead_merge_map merge_map
WHERE notification.type = 'channel_talk_quote_lead'
  AND (
    notification.dedupe_key = 'channel-talk-lead:' || merge_map.duplicate_id::text
    OR notification.data ->> 'lead_id' = merge_map.duplicate_id::text
  );

WITH latest_customer_message AS (
  SELECT DISTINCT ON (member.keeper_id)
    member.keeper_id,
    message.body,
    message.received_at,
    message.message_id
  FROM channel_talk_lead_merge_members member
  JOIN public.channel_talk_messages message
    ON message.user_chat_id = member.channel_talk_user_chat_id
  WHERE message.sender_type = 'user'
  ORDER BY member.keeper_id, message.received_at DESC, message.created_at DESC
),
customer_message_counts AS (
  SELECT
    member.keeper_id,
    count(message.id)::integer AS message_count
  FROM (
    SELECT DISTINCT keeper_id, channel_talk_user_chat_id
    FROM channel_talk_lead_merge_members
  ) member
  JOIN public.channel_talk_messages message
    ON message.user_chat_id = member.channel_talk_user_chat_id
   AND message.sender_type = 'user'
  GROUP BY member.keeper_id
),
merged_file_keys AS (
  SELECT
    member.keeper_id,
    array_remove(array_agg(DISTINCT file_key), NULL) AS file_keys
  FROM channel_talk_lead_merge_members member
  JOIN public.channel_talk_quote_leads lead
    ON lead.id = member.lead_id
  LEFT JOIN LATERAL unnest(lead.channel_talk_file_keys) AS file_key ON TRUE
  GROUP BY member.keeper_id
),
duplicate_ids AS (
  SELECT
    keeper_id,
    jsonb_agg(duplicate_id::text ORDER BY duplicate_id::text) AS duplicate_lead_ids,
    count(*)::integer AS duplicate_count
  FROM channel_talk_lead_merge_map
  GROUP BY keeper_id
)
UPDATE public.channel_talk_quote_leads keeper
SET
  conversation_id = COALESCE(
    keeper.conversation_id,
    (
      SELECT conversation.id
      FROM public.channel_talk_conversations conversation
      WHERE conversation.user_chat_id = keeper.channel_talk_user_chat_id
      LIMIT 1
    )
  ),
  channel_talk_file_keys = CASE
    WHEN coalesce(array_length(merged_file_keys.file_keys, 1), 0) > 0 THEN merged_file_keys.file_keys
    ELSE keeper.channel_talk_file_keys
  END,
  last_message_text = COALESCE(latest_customer_message.body, keeper.last_message_text),
  last_message_at = COALESCE(latest_customer_message.received_at, keeper.last_message_at),
  last_channel_talk_message_id = COALESCE(latest_customer_message.message_id, keeper.last_channel_talk_message_id),
  message_count = GREATEST(keeper.message_count, COALESCE(customer_message_counts.message_count, 0)),
  analysis = COALESCE(keeper.analysis, '{}'::jsonb)
    || jsonb_build_object(
      'merged_duplicate_lead_ids', duplicate_ids.duplicate_lead_ids,
      'merged_duplicate_count', duplicate_ids.duplicate_count
    ),
  updated_at = now()
FROM duplicate_ids
LEFT JOIN latest_customer_message
  ON latest_customer_message.keeper_id = duplicate_ids.keeper_id
LEFT JOIN customer_message_counts
  ON customer_message_counts.keeper_id = duplicate_ids.keeper_id
LEFT JOIN merged_file_keys
  ON merged_file_keys.keeper_id = duplicate_ids.keeper_id
WHERE keeper.id = duplicate_ids.keeper_id;

UPDATE public.channel_talk_quote_leads duplicate
SET
  status = 'closed',
  closed_at = COALESCE(duplicate.closed_at, now()),
  memo = concat_ws(
    E'\n',
    NULLIF(duplicate.memo, ''),
    '시스템: 같은 채널톡 상담방의 활성 중복 리드가 최신 리드로 병합되어 종료되었습니다.'
  ),
  updated_at = now()
FROM channel_talk_lead_merge_map merge_map
WHERE duplicate.id = merge_map.duplicate_id;

WITH latest_keeper AS (
  SELECT DISTINCT ON (merge_map.channel_talk_user_chat_id)
    merge_map.channel_talk_user_chat_id,
    merge_map.keeper_id
  FROM channel_talk_lead_merge_map merge_map
  ORDER BY merge_map.channel_talk_user_chat_id, merge_map.keeper_id
)
UPDATE public.channel_talk_conversations conversation
SET
  latest_lead_id = latest_keeper.keeper_id,
  status = CASE WHEN conversation.status = 'closed' THEN 'active' ELSE conversation.status END,
  updated_at = now()
FROM latest_keeper
WHERE conversation.user_chat_id = latest_keeper.channel_talk_user_chat_id;

COMMENT ON INDEX public.idx_channel_talk_quote_leads_active_user_chat_latest IS
  'Find the latest active Channel Talk lead by userChat so new messages merge into one active inquiry.';
