-- Extend issued quote delivery calendar sync to use project_stage, including delivery scheduled/delivered states.

CREATE OR REPLACE FUNCTION public.calendar_sync_saved_quote(_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q record;
  v_title text;
  v_project_stage text;
  v_delivery_completed boolean;
  v_issued_event_id uuid;
  v_delivery_event_id uuid;
BEGIN
  SELECT sq.*, p.status AS linked_project_status
  INTO q
  FROM public.saved_quotes sq
  LEFT JOIN public.projects p ON p.id = sq.project_id
  WHERE sq.id = _quote_id;

  IF NOT FOUND THEN
    UPDATE public.calendar_events
    SET status = 'canceled', updated_at = now()
    WHERE source_type = 'quote'
      AND source_id = _quote_id;
    RETURN;
  END IF;

  v_project_stage := CASE
    WHEN q.project_stage IN (
      'reviewing',
      'quote_issued',
      'revision_requested',
      'on_hold',
      'contracted',
      'invoice_issued',
      'in_progress',
      'panel_ordered',
      'manufacturing',
      'completed',
      'delivery_scheduled',
      'delivered',
      'cancelled'
    ) THEN q.project_stage
    WHEN q.quote_status = 'won' THEN 'contracted'
    WHEN q.quote_status = 'cancelled' THEN 'cancelled'
    WHEN q.quote_status IN ('reviewing', 'revision_requested', 'on_hold') THEN q.quote_status
    ELSE 'quote_issued'
  END;

  v_title := COALESCE(NULLIF(q.project_name, ''), NULLIF(q.recipient_company, ''), '견적 ' || q.quote_number);

  IF q.quote_date IS NOT NULL THEN
    v_issued_event_id := public.calendar_upsert_source_event(
      'quote',
      q.id,
      'issued',
      '견적 발행 · ' || v_title,
      '견적번호 ' || q.quote_number,
      public.calendar_day_start_at((q.quote_date AT TIME ZONE 'Asia/Seoul')::date),
      public.calendar_day_end_at((q.quote_date AT TIME ZONE 'Asia/Seoul')::date),
      true,
      NULL,
      'title_only',
      'scheduled',
      q.user_id,
      COALESCE(NULLIF(q.issuer_name, ''), NULLIF(q.assigned_to_name, ''), '견적 담당자'),
      q.issuer_department,
      NULL,
      q.recipient_company,
      q.recipient_phone,
      '/saved-quotes/' || q.id::text,
      '#2563eb',
      'quote',
      jsonb_build_object(
        'quote_number', q.quote_number,
        'project_name', q.project_name,
        'recipient_company', q.recipient_company,
        'project_stage', v_project_stage,
        'calendar_kind', 'quote_issued'
      )
    );

    PERFORM public.calendar_replace_event_participants(
      v_issued_event_id,
      q.user_id,
      '{}'::uuid[],
      CASE WHEN q.assigned_to IS NOT NULL THEN ARRAY[q.assigned_to]::uuid[] ELSE '{}'::uuid[] END
    );
  ELSE
    DELETE FROM public.calendar_events
    WHERE source_type = 'quote'
      AND source_id = q.id
      AND source_subtype = 'issued';
  END IF;

  v_delivery_completed := v_project_stage = 'delivered';

  IF q.desired_delivery_date IS NOT NULL
    AND v_project_stage IN (
      'contracted',
      'invoice_issued',
      'in_progress',
      'panel_ordered',
      'manufacturing',
      'completed',
      'delivery_scheduled',
      'delivered'
    )
    AND COALESCE(q.linked_project_status, '') <> 'cancelled'
  THEN
    v_delivery_event_id := public.calendar_upsert_source_event(
      'quote',
      q.id,
      'delivery',
      CASE WHEN v_delivery_completed THEN '납기 완료 · ' ELSE '납기 예정 · ' END || v_title,
      '견적번호 ' || q.quote_number,
      public.calendar_day_start_at((q.desired_delivery_date AT TIME ZONE 'Asia/Seoul')::date),
      public.calendar_day_end_at((q.desired_delivery_date AT TIME ZONE 'Asia/Seoul')::date),
      true,
      q.recipient_address,
      'title_only',
      CASE WHEN v_delivery_completed THEN 'completed' ELSE 'scheduled' END,
      q.user_id,
      COALESCE(NULLIF(q.issuer_name, ''), NULLIF(q.assigned_to_name, ''), '견적 담당자'),
      q.issuer_department,
      NULL,
      q.recipient_company,
      q.recipient_phone,
      '/saved-quotes/' || q.id::text,
      CASE WHEN v_delivery_completed THEN '#16a34a' ELSE '#f97316' END,
      'delivery',
      jsonb_build_object(
        'quote_number', q.quote_number,
        'quote_status', q.quote_status,
        'project_stage', v_project_stage,
        'delivery_state', CASE WHEN v_delivery_completed THEN 'completed' ELSE 'scheduled' END,
        'project_name', q.project_name,
        'recipient_company', q.recipient_company,
        'calendar_kind', 'quote_delivery'
      )
    );

    PERFORM public.calendar_replace_event_participants(
      v_delivery_event_id,
      q.user_id,
      '{}'::uuid[],
      CASE WHEN q.assigned_to IS NOT NULL THEN ARRAY[q.assigned_to]::uuid[] ELSE '{}'::uuid[] END
    );
  ELSE
    DELETE FROM public.calendar_events
    WHERE source_type = 'quote'
      AND source_id = q.id
      AND source_subtype = 'delivery';
  END IF;
END;
$$;

COMMENT ON COLUMN public.saved_quotes.project_stage IS 'Single workflow stage for issued quotes, from quote review through production, delivery schedule, and delivery completion.';

SELECT public.calendar_sync_saved_quote(id)
FROM public.saved_quotes;
