CREATE TABLE IF NOT EXISTS public.public_booking_schedule_cache (
  cache_key text PRIMARY KEY,
  link_id uuid NOT NULL REFERENCES public.public_booking_links(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  stored_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

GRANT ALL ON public.public_booking_schedule_cache TO service_role;

ALTER TABLE public.public_booking_schedule_cache ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_public_booking_schedule_cache_link ON public.public_booking_schedule_cache(link_id);
CREATE INDEX IF NOT EXISTS idx_public_booking_schedule_cache_expires ON public.public_booking_schedule_cache(expires_at);