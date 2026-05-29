
## Goal
Apply two calendar migrations to the production Supabase DB in order, then run a structured verification checklist. No source code changes.

## Source files
- `user-uploads://20260529120000_internal_calendar_system.sql` (1134 lines) — creates `calendar_events`, `calendar_event_participants`, `calendar_resources` (seeds `1층 회의실`, `2층 회의실`), `calendar_event_resources`, `calendar_subscriptions`, RLS, and v1 of `get_calendar_events` / `get_calendar_dashboard_summary` / `create_calendar_event` / `update_calendar_event` / `sync_meeting_reservation_calendar_event`.
- `user-uploads://20260529133000_calendar_source_integrations.sql` (1301 lines) — adds `source_subtype`/`source_path`/`accent`/`icon_type`, replaces source-type CHECK, recreates `idx_calendar_events_source_unique(source_type, source_id, source_subtype) WHERE source_id IS NOT NULL`, adds sync RPCs + triggers for quote/project/leave/holiday/peer_meeting/announcement_event/meeting_reservation, redefines `get_calendar_events` / `get_calendar_dashboard_summary`, and runs full backfill.

## Steps

1. **Pre-flight snapshot** (read-only)
   - Inspect current state of `public.calendar_events` columns, indexes, RPC signatures, and `calendar_resources` rows so any partial prior run is visible before applying SQL.

2. **Apply migration 1** via `supabase--migration`
   - Submit the full contents of `20260529120000_internal_calendar_system.sql` as a single migration. All statements use `IF NOT EXISTS` / `CREATE OR REPLACE`, so a partial prior run is tolerated. If a CHECK or POLICY definition was already created with different shape and rejects re-apply, the next migration (M2) restates them and supersedes.

3. **Apply migration 2** via `supabase--migration`
   - Submit the full contents of `20260529133000_calendar_source_integrations.sql`. This includes the backfill `SELECT public.calendar_sync_*(id) FROM ...` calls at the tail.

4. **Verification checklist** (read-only SQL via `supabase--read_query`, capture verbatim output)
   - **Columns**: `information_schema.columns` for `calendar_events` → confirm `source_subtype`, `source_path`, `accent`, `icon_type` exist.
   - **Unique index**: `pg_indexes` → confirm `idx_calendar_events_source_unique` definition includes `(source_type, source_id, source_subtype)` with `WHERE (source_id IS NOT NULL)`.
   - **Resources**: `SELECT name FROM calendar_resources` → confirm rows `1층 회의실` and `2층 회의실` (Korean equivalents accepted per spec).
   - **RPC callability**:
     ```sql
     SELECT count(*) FROM public.get_calendar_events(now() - interval '30 day', now() + interval '30 day', '{}'::jsonb);
     SELECT public.get_calendar_dashboard_summary(now() - interval '30 day', now() + interval '30 day', 'all');
     ```
   - **Backfill counts**: `SELECT source_type, count(*) FROM calendar_events GROUP BY source_type` → confirm rows exist for each source whose source table has data (`quote`, `project`, `leave`, `holiday`, `peer_meeting`, `announcement_event`, `meeting_reservation`). Cross-reference with `saved_quotes`, `projects`, `leave_requests`, `company_holidays`, `peer_feedback`, `announcements`, `meeting_reservations` row counts to flag source_types where backfill produced 0 rows despite source data being present.

5. **Preview QA**
   - Reload `/` (home dashboard) and `/calendar`, capture browser console + network for any 4xx/500 from `get_calendar_events` / `get_calendar_dashboard_summary` or `PGRST` schema errors, and report.

## Error-handling policy
- If any migration statement fails, capture the verbatim Postgres error (code + message + line) and stop. Do **not** edit source files. If the failure is from a leftover artifact of a prior partial run (e.g. existing index with a different definition, existing CHECK with old enum), report it with the exact object definition and ask before issuing a targeted DROP/ALTER to make the migration idempotently complete.
- If a backfill `SELECT public.calendar_sync_*()` errors mid-set (e.g. malformed source row), report the offending source id and error, then continue verification with the partial state.

## Deliverable
A single report containing, per verification item: PASS/FAIL + raw SQL output (or raw Postgres error). Then `/calendar` + dashboard console snapshot. No code changes will be committed.
