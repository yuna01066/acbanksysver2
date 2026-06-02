-- Show quote delivery dates on the calendar only after the quote is won.

CREATE OR REPLACE FUNCTION public.calendar_sync_saved_quote(_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q record;
  v_title text;
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

  IF q.desired_delivery_date IS NOT NULL
    AND q.quote_status = 'won'
    AND COALESCE(q.project_stage, '') <> 'cancelled'
    AND COALESCE(q.linked_project_status, '') <> 'cancelled'
  THEN
    v_delivery_event_id := public.calendar_upsert_source_event(
      'quote',
      q.id,
      'delivery',
      '납기 예정 · ' || v_title,
      '견적번호 ' || q.quote_number,
      public.calendar_day_start_at((q.desired_delivery_date AT TIME ZONE 'Asia/Seoul')::date),
      public.calendar_day_end_at((q.desired_delivery_date AT TIME ZONE 'Asia/Seoul')::date),
      true,
      q.recipient_address,
      'title_only',
      'scheduled',
      q.user_id,
      COALESCE(NULLIF(q.issuer_name, ''), NULLIF(q.assigned_to_name, ''), '견적 담당자'),
      q.issuer_department,
      NULL,
      q.recipient_company,
      q.recipient_phone,
      '/saved-quotes/' || q.id::text,
      '#f97316',
      'delivery',
      jsonb_build_object(
        'quote_number', q.quote_number,
        'quote_status', q.quote_status,
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

SELECT public.calendar_sync_saved_quote(id)
FROM public.saved_quotes;
