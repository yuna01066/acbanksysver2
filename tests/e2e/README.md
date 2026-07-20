# Public Meeting Booking E2E tests

End-to-end verification for the public meeting booking flow. The suite
auto-provisions a temporary link with the admin's session token, exercises
the approve and reject flows through the live `public-meeting-booking` Edge
Function, verifies the resulting `calendar_events` rows, and cleans everything
up afterwards.

## What is covered

`tests/e2e/public-booking.spec.ts`:

1. Admin login (email + password) against Supabase Auth → session token.
2. Auto-picks the first active `calendar_resources` row (or uses
   `E2E_RESOURCE_ID` when set).
3. Inserts a fresh `public_booking_links` row (`link_type=customer_request`,
   `requires_approval=true`, all weekdays, `min_notice_minutes=0`) via the
   authenticated PostgREST endpoint. Slug is unique per run.
4. Approval flow: `get-link` → `get-availability` → `create-request` →
   `confirm-request` → asserts a `calendar_events` row with
   `source_type='external_booking'`.
5. Rejection flow: `create-request` → `reject-request` → asserts no calendar
   event was created for that request.
6. Cleanup: deletes the confirmed event, both request rows, and the
   provisioned link.

## Required env vars

```
E2E_SUPABASE_URL=https://<ref>.supabase.co
E2E_SUPABASE_ANON_KEY=<anon key>
E2E_ADMIN_EMAIL=<admin or moderator email>
E2E_ADMIN_PASSWORD=<password>
```

## Optional env vars

```
E2E_RESOURCE_ID=<calendar_resources.id>   # skip auto-pick and use this one
```

## Running

```
E2E_SUPABASE_URL=... \
E2E_SUPABASE_ANON_KEY=... \
E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... \
bun run test:e2e
```

No manual link setup is required — every run creates and cleans up its own
`public_booking_links` row. Requires at least one active
`calendar_resources` entry in the project.
