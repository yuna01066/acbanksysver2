CREATE TABLE IF NOT EXISTS public.public_booking_request_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.public_booking_requests(id) ON DELETE CASCADE,
  link_id uuid REFERENCES public.public_booking_links(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('requested','auto_confirmed','confirmed','rejected','canceled','expired','note')),
  from_status text,
  to_status text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_label text,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_booking_request_events_request_idx
  ON public.public_booking_request_events (request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS public_booking_request_events_created_idx
  ON public.public_booking_request_events (created_at DESC);

GRANT SELECT ON public.public_booking_request_events TO authenticated;
GRANT ALL ON public.public_booking_request_events TO service_role;

ALTER TABLE public.public_booking_request_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and moderators can read public booking request events" ON public.public_booking_request_events;
CREATE POLICY "Admins and moderators can read public booking request events"
  ON public.public_booking_request_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Service role manages public booking request events" ON public.public_booking_request_events;
CREATE POLICY "Service role manages public booking request events"
  ON public.public_booking_request_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';