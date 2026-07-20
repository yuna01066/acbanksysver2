# Public Meeting Booking E2E tests

End-to-end verification for the public meeting booking flow. The tests drive the
live `public-meeting-booking` Edge Function through Playwright's `request`
context and verify results against the Supabase REST API.

## What is covered

`tests/e2e/public-booking.spec.ts` runs the full lifecycle for a customer
booking link (`requires_approval = true`):

1. `get-link` — fetches the public link metadata via the slug.
2. `get-availability` — retrieves available time slots for the next allowed day.
3. `create-request` — submits a booking request as an anonymous visitor.
4. Admin login (email + password) against Supabase Auth.
5. `confirm-request` — approves the request as an admin/moderator.
6. Verifies the resulting `calendar_events` row exists with
   `source_type = 'external_booking'`.
7. Repeats steps 1–3 with new data, then `reject-request` and asserts no
   calendar event is created.
8. Cleans up both requests (and any provisioned link/resource) via the REST API
   using the admin session token.

## Required env vars

```
E2E_SUPABASE_URL=https://<ref>.supabase.co
E2E_SUPABASE_ANON_KEY=<anon key>
E2E_ADMIN_EMAIL=<admin or moderator email>
E2E_ADMIN_PASSWORD=<password>
```

## Optional env vars

If omitted, the test suite skips provisioning and expects an existing active
customer_request link and one allowed resource:

```
E2E_PUBLIC_BOOKING_SLUG=<slug of an active customer_request link>
E2E_RESOURCE_ID=<uuid of a calendar_resource allowed by the link>
```

If both are provided the test uses them and only cleans up the requests it
creates. If either is missing the test will fail early with a clear message —
create a test link at `/meeting-reservations?tab=public` first.

## Running

```
E2E_SUPABASE_URL=... \
E2E_SUPABASE_ANON_KEY=... \
E2E_ADMIN_EMAIL=... \
E2E_ADMIN_PASSWORD=... \
E2E_PUBLIC_BOOKING_SLUG=... \
E2E_RESOURCE_ID=... \
bunx playwright test
```
