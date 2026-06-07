-- System-generated pay statements with publish/void workflow.

ALTER TABLE public.pay_statements
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'voided')),
  ADD COLUMN IF NOT EXISTS pay_period_start DATE,
  ADD COLUMN IF NOT EXISTS pay_period_end DATE,
  ADD COLUMN IF NOT EXISTS payment_date DATE,
  ADD COLUMN IF NOT EXISTS earnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_deductions NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS memo TEXT,
  ADD COLUMN IF NOT EXISTS internal_note TEXT,
  ADD COLUMN IF NOT EXISTS issued_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS downloaded_at TIMESTAMPTZ;

UPDATE public.pay_statements
SET
  status = COALESCE(NULLIF(status, ''), CASE WHEN published_at IS NULL THEN 'draft' ELSE 'published' END),
  pay_period_start = COALESCE(pay_period_start, date_trunc('month', pay_month)::date),
  pay_period_end = COALESCE(pay_period_end, (date_trunc('month', pay_month)::date + INTERVAL '1 month - 1 day')::date),
  payment_date = COALESCE(payment_date, pay_month),
  earnings = CASE
    WHEN jsonb_typeof(earnings) = 'array' AND jsonb_array_length(earnings) > 0 THEN earnings
    WHEN COALESCE(gross_pay, 0) > 0 THEN jsonb_build_array(jsonb_build_object('label', '총 지급액', 'amount', gross_pay))
    ELSE '[]'::jsonb
  END,
  deductions = CASE
    WHEN jsonb_typeof(deductions) = 'array' THEN deductions
    WHEN jsonb_typeof(deductions) = 'object' AND deductions <> '{}'::jsonb THEN (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('label', key, 'amount', value::numeric)), '[]'::jsonb)
      FROM jsonb_each_text(deductions)
      WHERE value ~ '^-?[0-9]+(\.[0-9]+)?$'
    )
    ELSE '[]'::jsonb
  END,
  total_deductions = CASE
    WHEN COALESCE(total_deductions, 0) = 0
      AND COALESCE(gross_pay, 0) >= COALESCE(net_pay, 0)
      THEN COALESCE(gross_pay, 0) - COALESCE(net_pay, 0)
    ELSE total_deductions
  END,
  issued_at = COALESCE(issued_at, published_at),
  issued_by = COALESCE(issued_by, user_id)
WHERE TRUE;

ALTER TABLE public.pay_statements
  DROP CONSTRAINT IF EXISTS pay_statements_amounts_non_negative;

ALTER TABLE public.pay_statements
  ADD CONSTRAINT pay_statements_amounts_non_negative
  CHECK (
    COALESCE(gross_pay, 0) >= 0
    AND COALESCE(total_deductions, 0) >= 0
    AND COALESCE(net_pay, 0) >= 0
  );

CREATE INDEX IF NOT EXISTS idx_pay_statements_status_month
  ON public.pay_statements (status, pay_month DESC);

CREATE INDEX IF NOT EXISTS idx_pay_statements_published_user_month
  ON public.pay_statements (user_id, pay_month DESC)
  WHERE status = 'published';

CREATE TABLE IF NOT EXISTS public.pay_statement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_statement_id UUID NOT NULL REFERENCES public.pay_statements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated', 'published', 'viewed', 'downloaded', 'voided')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pay_statement_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own pay statement events" ON public.pay_statement_events;
CREATE POLICY "Users can view own pay statement events"
  ON public.pay_statement_events FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Salary managers can manage pay statement events" ON public.pay_statement_events;
CREATE POLICY "Salary managers can manage pay statement events"
  ON public.pay_statement_events FOR ALL
  USING (public.can_access_feature('finance.view_salary'))
  WITH CHECK (public.can_access_feature('finance.view_salary'));

CREATE INDEX IF NOT EXISTS idx_pay_statement_events_statement_created
  ON public.pay_statement_events (pay_statement_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pay_statement_events_user_created
  ON public.pay_statement_events (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.record_pay_statement_event(
  p_statement_id UUID,
  p_event_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_statement RECORD;
BEGIN
  IF p_event_type NOT IN ('viewed', 'downloaded') THEN
    RAISE EXCEPTION 'Unsupported pay statement event type: %', p_event_type;
  END IF;

  SELECT id, user_id, status
  INTO v_statement
  FROM public.pay_statements
  WHERE id = p_statement_id;

  IF v_statement.id IS NULL THEN
    RAISE EXCEPTION 'Pay statement not found';
  END IF;

  IF v_statement.user_id <> auth.uid() AND NOT public.can_access_feature('finance.view_salary') THEN
    RAISE EXCEPTION 'Not allowed to record this pay statement event';
  END IF;

  IF v_statement.user_id = auth.uid() AND v_statement.status <> 'published' THEN
    RAISE EXCEPTION 'Only published pay statements can be recorded by employees';
  END IF;

  IF p_event_type = 'viewed' THEN
    UPDATE public.pay_statements
    SET viewed_at = COALESCE(viewed_at, now())
    WHERE id = p_statement_id;
  ELSE
    UPDATE public.pay_statements
    SET downloaded_at = now()
    WHERE id = p_statement_id;
  END IF;

  INSERT INTO public.pay_statement_events (
    pay_statement_id,
    user_id,
    actor_id,
    event_type,
    metadata
  )
  VALUES (
    p_statement_id,
    v_statement.user_id,
    auth.uid(),
    p_event_type,
    jsonb_build_object('source', 'my_page')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_pay_statement_event(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_pay_statement_event(UUID, TEXT) TO authenticated;

DROP POLICY IF EXISTS "Users can view own pay statements" ON public.pay_statements;
CREATE POLICY "Users can view own published pay statements"
  ON public.pay_statements FOR SELECT
  USING (auth.uid() = user_id AND status = 'published');

COMMENT ON COLUMN public.pay_statements.status IS '급여명세 발행 상태: draft, published, voided';
COMMENT ON COLUMN public.pay_statements.earnings IS '지급 항목 배열. 예: [{"label":"기본급","amount":2500000}]';
COMMENT ON COLUMN public.pay_statements.deductions IS '공제 항목 배열. 예: [{"label":"소득세","amount":120000}]';

INSERT INTO public.page_role_access (page_key, min_role)
VALUES ('finance.view_salary', 'moderator')
ON CONFLICT (page_key) DO UPDATE
SET min_role = EXCLUDED.min_role;
