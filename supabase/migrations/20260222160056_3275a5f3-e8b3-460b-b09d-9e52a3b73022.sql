
-- 상담일지/메모 테이블
CREATE TABLE public.recipient_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID NOT NULL REFERENCES public.recipients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'memo',
  title TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recipient_notes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view recipient notes" ON public.recipient_notes FOR SELECT USING (true);
CREATE POLICY "Users can create recipient notes" ON public.recipient_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON public.recipient_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON public.recipient_notes FOR DELETE USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_recipient_notes_recipient_id ON public.recipient_notes(recipient_id);
CREATE INDEX idx_recipient_notes_created_at ON public.recipient_notes(created_at DESC);

-- Updated at trigger
CREATE TRIGGER update_recipient_notes_updated_at
  BEFORE UPDATE ON public.recipient_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
