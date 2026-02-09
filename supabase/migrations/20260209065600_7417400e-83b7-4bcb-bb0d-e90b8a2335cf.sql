
-- Add meeting-specific columns to peer_feedback
ALTER TABLE public.peer_feedback 
  ADD COLUMN meeting_date DATE NULL,
  ADD COLUMN meeting_time TEXT NULL,
  ADD COLUMN meeting_status TEXT NOT NULL DEFAULT 'pending';

-- meeting_status: 'pending', 'accepted', 'declined', 'rescheduled'
