# Channel Talk Webhook

Receives Channel Talk user chat message webhooks, detects customer file attachments, runs quote-oriented AI analysis, stores the result in `channel_talk_quote_leads`, and posts a private summary back to the Channel Talk user chat.

## Webhook URL

After deploying the function, register this URL in Channel Talk:

```text
https://zwloyqcwyfkimwkohpnd.supabase.co/functions/v1/channel-talk-webhook?token=<CHANNEL_TALK_WEBHOOK_TOKEN>
```

Recommended Channel Talk webhook scopes:

- User chat message
- User chat opened, if you also want to log first-open events later

## Required Secrets

Set these in Supabase function secrets. Do not commit real values.

```text
CHANNEL_TALK_ACCESS_KEY
CHANNEL_TALK_ACCESS_SECRET
CHANNEL_TALK_WEBHOOK_TOKEN
LOVABLE_API_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

## Notes

- The function ignores manager and bot messages to avoid loops.
- Summary messages are sent with Channel Talk `private` and `silent` options, so they are intended for internal staff review.
- Image attachments are analyzed directly. Unsupported formats are stored and marked for manual review.
