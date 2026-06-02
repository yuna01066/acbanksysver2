# Channel Talk Webhook

Receives Channel Talk user chat message webhooks, stores customer messages in `channel_talk_messages`, detects customer file attachments, runs quote-oriented AI analysis, stores the result in `channel_talk_quote_leads`, and posts a private summary back to the Channel Talk user chat when files are analyzed.

## Webhook URL

After deploying the function, register this URL in Channel Talk:

```text
https://zwloyqcwyfkimwkohpnd.supabase.co/functions/v1/channel-talk-webhook?token=<CHANNEL_TALK_WEBHOOK_TOKEN>
```

Recommended Channel Talk webhook scopes:

- User chat message
- User chat opened, if you also want to log first-open events later

Use Channel Talk Webhooks for inbound consultation sync. Channel Talk custom functions are intended for staff/AI helper actions such as internal customer lookup, quote lookup, or stock lookup, not for passive message ingestion.

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
- Text-only customer messages are stored as leads without automatic customer replies.
- Repeated messages in the same active inquiry update the existing lead and notification instead of creating a new notification row every time.
- JPG/PNG/WebP image attachments and PDFs are analyzed directly.
- AI/CAD/DXF/DWG/EPS and other source files are treated as originals for manual review; the bot asks for a PDF/JPG/PNG preview file for faster automatic analysis.

## Internal reply actions

The `channel-talk-actions` function is JWT protected and supports:

- `send_private_note`: sends a private/silent Channel Talk memo.
- `send_customer_reply`: sends a staff-confirmed customer-visible reply.
- `refresh_messages`: syncs recent UserChat messages into `channel_talk_messages`.
- `mark_lead_closed`: closes the internal lead.

All actions are written to `channel_talk_action_logs`.
