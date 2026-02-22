
CREATE TABLE public.secret_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🎉',
  message TEXT NOT NULL,
  sub_message TEXT,
  event_type TEXT NOT NULL DEFAULT 'custom',
  trigger_hour INTEGER,
  trigger_minute INTEGER,
  trigger_day_of_week INTEGER,
  trigger_date INTEGER,
  trigger_month INTEGER,
  gradient TEXT DEFAULT 'from-primary/15 via-primary/10 to-accent/10',
  particles TEXT[] DEFAULT ARRAY['✨', '🎉'],
  sound_enabled BOOLEAN DEFAULT false,
  sound_freq INTEGER DEFAULT 440,
  is_active BOOLEAN DEFAULT true,
  display_duration INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.secret_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read secret events"
  ON public.secret_events FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert secret events"
  ON public.secret_events FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
  );

CREATE POLICY "Admins can update secret events"
  ON public.secret_events FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
  );

CREATE POLICY "Admins can delete secret events"
  ON public.secret_events FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
  );
