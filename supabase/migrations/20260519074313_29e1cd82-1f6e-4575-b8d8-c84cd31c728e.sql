-- Personal quote draft workspace.

-- Drafts are intentionally separated from saved_quotes so issued quote lists,

-- project status, sales statistics, and existing quote snapshots are unaffected.

CREATE TABLE IF NOT EXISTS public.quote_drafts (

  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title TEXT NOT NULL DEFAULT '새 견적 초안',

  recipient JSONB,

  items JSONB NOT NULL DEFAULT '[]'::jsonb,

  subtotal NUMERIC NOT NULL DEFAULT 0,

  tax NUMERIC NOT NULL DEFAULT 0,

  total NUMERIC NOT NULL DEFAULT 0,

  quote_style TEXT NOT NULL DEFAULT 'panel',

  status TEXT NOT NULL DEFAULT 'active',

  issued_quote_id UUID REFERENCES public.saved_quotes(id) ON DELETE SET NULL,

  issued_at TIMESTAMPTZ,

  last_opened_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT quote_drafts_status_check CHECK (status IN ('active', 'issued', 'archived')),

  CONSTRAINT quote_drafts_title_len CHECK (char_length(title) <= 150)

);

ALTER TABLE public.quote_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own quote drafts" ON public.quote_drafts;

DROP POLICY IF EXISTS "Users can create their own quote drafts" ON public.quote_drafts;

DROP POLICY IF EXISTS "Users can update their own quote drafts" ON public.quote_drafts;

DROP POLICY IF EXISTS "Users can delete their own quote drafts" ON public.quote_drafts;

CREATE POLICY "Users can view their own quote drafts"

ON public.quote_drafts

FOR SELECT

TO authenticated

USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own quote drafts"

ON public.quote_drafts

FOR INSERT

TO authenticated

WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quote drafts"

ON public.quote_drafts

FOR UPDATE

TO authenticated

USING (auth.uid() = user_id)

WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quote drafts"

ON public.quote_drafts

FOR DELETE

TO authenticated

USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_quote_drafts_updated_at ON public.quote_drafts;

CREATE TRIGGER update_quote_drafts_updated_at

BEFORE UPDATE ON public.quote_drafts

FOR EACH ROW

EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_quote_drafts_user_status_updated

  ON public.quote_drafts(user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_drafts_issued_quote_id

  ON public.quote_drafts(issued_quote_id);

COMMENT ON TABLE public.quote_drafts IS '직원 개인별 견적서 초안함';

COMMENT ON COLUMN public.quote_drafts.recipient IS '초안 단계의 견적 수신/발신 정보';

COMMENT ON COLUMN public.quote_drafts.items IS '초안 단계의 견적 항목 배열';