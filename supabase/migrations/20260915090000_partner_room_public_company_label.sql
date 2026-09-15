-- Show a safe company label for the existing shared-company room booking link.
UPDATE public.public_booking_links
SET metadata = COALESCE(metadata, '{}'::jsonb)
  || jsonb_build_object('public_schedule_default_company_name', 'PROG')
WHERE slug = 'partner-room-u1utr81v3nyqr'
  AND link_type = 'partner_room'
  AND COALESCE(metadata->>'public_schedule_default_company_name', '') = '';
