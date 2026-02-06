
-- Create table to store Pluuug reverse sync events (changes detected from Pluuug)
CREATE TABLE public.pluuug_sync_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id uuid NOT NULL,
  user_id uuid NOT NULL,
  event_type text NOT NULL, -- 'deleted', 'modified'
  pluuug_estimate_id text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb, -- changed fields, pluuug data snapshot
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'resolved', 'dismissed'
  resolved_action text, -- 'delete_local', 'unlink', 'update_local', 'dismiss'
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  CONSTRAINT valid_event_type CHECK (event_type IN ('deleted', 'modified')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'resolved', 'dismissed'))
);

-- Enable RLS
ALTER TABLE public.pluuug_sync_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own sync events
CREATE POLICY "Users can view their own sync events"
ON public.pluuug_sync_events
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own sync events (resolve/dismiss)
CREATE POLICY "Users can update their own sync events"
ON public.pluuug_sync_events
FOR UPDATE
USING (auth.uid() = user_id);

-- Service role can insert (edge function)
CREATE POLICY "Service role can insert sync events"
ON public.pluuug_sync_events
FOR INSERT
WITH CHECK (true);

-- Admins can manage all sync events
CREATE POLICY "Admins can manage sync events"
ON public.pluuug_sync_events
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for quick lookup
CREATE INDEX idx_sync_events_user_status ON public.pluuug_sync_events (user_id, status);
CREATE INDEX idx_sync_events_quote_id ON public.pluuug_sync_events (quote_id);

-- Enable pg_cron and pg_net extensions for scheduled sync
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
