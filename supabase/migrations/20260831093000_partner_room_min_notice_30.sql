-- Set the existing shared-company room booking link to allow reservations 30 minutes ahead
-- and show limited public schedule details for bookings made through this shared link.
UPDATE public.public_booking_links
SET
  min_notice_minutes = 30,
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('public_schedule_details_enabled', true),
  updated_at = now()
WHERE slug = 'partner-room-u1utr81v3nyqr'
  AND link_type = 'partner_room'
  AND (
    min_notice_minutes <> 30
    OR COALESCE(metadata->>'public_schedule_details_enabled', 'false') <> 'true'
  );
