ALTER TABLE public.channel_talk_quote_leads
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS memo TEXT,
  ADD COLUMN IF NOT EXISTS converted_quote_id UUID REFERENCES public.saved_quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_channel_talk_quote_leads_assigned_to
  ON public.channel_talk_quote_leads(assigned_to);

CREATE INDEX IF NOT EXISTS idx_channel_talk_quote_leads_converted_quote_id
  ON public.channel_talk_quote_leads(converted_quote_id);

COMMENT ON COLUMN public.channel_talk_quote_leads.assigned_to IS '채널톡 분석 리드 담당자';
COMMENT ON COLUMN public.channel_talk_quote_leads.memo IS '상담원 내부 메모';
COMMENT ON COLUMN public.channel_talk_quote_leads.converted_quote_id IS '분석 리드에서 전환된 저장 견적서';
COMMENT ON COLUMN public.channel_talk_quote_leads.closed_at IS '리드 종료 시각';
