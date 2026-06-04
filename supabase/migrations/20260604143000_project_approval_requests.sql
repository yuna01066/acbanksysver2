-- Project/quote approval workflow for project start, purchases, and expenses.

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL CHECK (request_type IN ('project_start', 'purchase_request', 'expense_payment')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'cancelled')),
  title TEXT NOT NULL,
  summary TEXT,
  amount NUMERIC,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  related_quote_id UUID REFERENCES public.saved_quotes(id) ON DELETE SET NULL,
  related_project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  related_material_order_id UUID REFERENCES public.material_orders(id) ON DELETE SET NULL,
  related_internal_document_id UUID REFERENCES public.internal_project_documents(id) ON DELETE SET NULL,
  payload_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  requested_by_name TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by_name TEXT,
  review_note TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.approval_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id UUID NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'submitted', 'approved', 'rejected', 'cancelled')),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name TEXT,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_request_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_approval_requests_status_created
  ON public.approval_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_requests_project_created
  ON public.approval_requests(related_project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_requests_quote_created
  ON public.approval_requests(related_quote_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requester_created
  ON public.approval_requests(requested_by, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_approval_requests_active_project_start
  ON public.approval_requests(related_project_id, request_type)
  WHERE request_type = 'project_start' AND status IN ('draft', 'pending', 'approved');
CREATE INDEX IF NOT EXISTS idx_approval_request_events_request_created
  ON public.approval_request_events(approval_request_id, created_at DESC);

DROP TRIGGER IF EXISTS update_approval_requests_updated_at ON public.approval_requests;
CREATE TRIGGER update_approval_requests_updated_at
BEFORE UPDATE ON public.approval_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.can_access_project_approval(_project_id UUID, _user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.has_role(_user_id, 'admin'::public.app_role)
    OR public.has_role(_user_id, 'moderator'::public.app_role)
    OR (_project_id IS NOT NULL AND public.is_project_owner(_project_id, _user_id))
    OR (_project_id IS NOT NULL AND public.is_project_assigned(_project_id, _user_id)),
    false
  );
$$;

DROP POLICY IF EXISTS "Approval reviewers can manage all requests" ON public.approval_requests;
CREATE POLICY "Approval reviewers can manage all requests"
ON public.approval_requests
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

DROP POLICY IF EXISTS "Project approval participants can view requests" ON public.approval_requests;
CREATE POLICY "Project approval participants can view requests"
ON public.approval_requests
FOR SELECT
TO authenticated
USING (
  requested_by = auth.uid()
  OR public.can_access_project_approval(related_project_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can create their own approval requests" ON public.approval_requests;
CREATE POLICY "Users can create their own approval requests"
ON public.approval_requests
FOR INSERT
TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND (
    related_project_id IS NULL
    OR public.can_access_project_approval(related_project_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Requesters can cancel own pending approval requests" ON public.approval_requests;
CREATE POLICY "Requesters can cancel own pending approval requests"
ON public.approval_requests
FOR UPDATE
TO authenticated
USING (requested_by = auth.uid() AND status IN ('draft', 'pending'))
WITH CHECK (requested_by = auth.uid());

DROP POLICY IF EXISTS "Approval request events are visible with request" ON public.approval_request_events;
CREATE POLICY "Approval request events are visible with request"
ON public.approval_request_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.approval_requests request
    WHERE request.id = approval_request_events.approval_request_id
      AND (
        request.requested_by = auth.uid()
        OR public.can_access_project_approval(request.related_project_id, auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Approval reviewers can manage request events" ON public.approval_request_events;
CREATE POLICY "Approval reviewers can manage request events"
ON public.approval_request_events
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

CREATE OR REPLACE FUNCTION public.get_profile_display_name(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(p.full_name, ''), p.email, '알 수 없음')
  FROM public.profiles p
  WHERE p.id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.notify_approval_reviewers(_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_row public.approval_requests;
BEGIN
  SELECT * INTO request_row
  FROM public.approval_requests
  WHERE id = _request_id;

  IF request_row.id IS NULL OR request_row.status <> 'pending' THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    description,
    data,
    dedupe_key
  )
  SELECT DISTINCT
    role_row.user_id,
    'approval_request',
    '품의 승인 요청',
    request_row.title,
    jsonb_build_object(
      'approvalRequestId', request_row.id,
      'projectId', request_row.related_project_id,
      'quoteId', request_row.related_quote_id,
      'requestType', request_row.request_type
    ),
    'approval-request:' || request_row.id::text
  FROM public.user_roles role_row
  WHERE role_row.role IN ('admin'::public.app_role, 'moderator'::public.app_role)
  ON CONFLICT (user_id, type, dedupe_key) DO UPDATE
  SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    data = EXCLUDED.data;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_approval_request(_payload JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request_type TEXT := COALESCE(_payload->>'request_type', _payload->>'requestType');
  v_status TEXT := COALESCE(_payload->>'status', 'pending');
  v_project_id UUID := NULLIF(COALESCE(_payload->>'related_project_id', _payload->>'relatedProjectId'), '')::UUID;
  v_quote_id UUID := NULLIF(COALESCE(_payload->>'related_quote_id', _payload->>'relatedQuoteId'), '')::UUID;
  v_material_order_id UUID := NULLIF(COALESCE(_payload->>'related_material_order_id', _payload->>'relatedMaterialOrderId'), '')::UUID;
  v_internal_document_id UUID := NULLIF(COALESCE(_payload->>'related_internal_document_id', _payload->>'relatedInternalDocumentId'), '')::UUID;
  v_amount NUMERIC := NULLIF(_payload->>'amount', '')::NUMERIC;
  v_title TEXT := NULLIF(_payload->>'title', '');
  v_summary TEXT := NULLIF(_payload->>'summary', '');
  v_priority TEXT := COALESCE(NULLIF(_payload->>'priority', ''), 'normal');
  v_snapshot JSONB := COALESCE(_payload->'payload_snapshot', _payload->'payloadSnapshot', '{}'::jsonb);
  v_request_id UUID;
  v_actor_name TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF v_request_type NOT IN ('project_start', 'purchase_request', 'expense_payment') THEN
    RAISE EXCEPTION '지원하지 않는 품의 유형입니다: %', v_request_type;
  END IF;

  IF v_status NOT IN ('draft', 'pending') THEN
    RAISE EXCEPTION '품의 생성 상태는 draft 또는 pending만 가능합니다.';
  END IF;

  IF v_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
    v_priority := 'normal';
  END IF;

  IF v_project_id IS NOT NULL AND NOT public.can_access_project_approval(v_project_id, v_user_id) THEN
    RAISE EXCEPTION '이 프로젝트의 품의를 생성할 권한이 없습니다.';
  END IF;

  IF v_request_type = 'project_start' AND v_project_id IS NOT NULL THEN
    SELECT id INTO v_request_id
    FROM public.approval_requests
    WHERE request_type = 'project_start'
      AND related_project_id = v_project_id
      AND status IN ('draft', 'pending', 'approved')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_request_id IS NOT NULL THEN
      RETURN v_request_id;
    END IF;
  END IF;

  v_actor_name := public.get_profile_display_name(v_user_id);

  INSERT INTO public.approval_requests (
    request_type,
    status,
    title,
    summary,
    amount,
    priority,
    related_quote_id,
    related_project_id,
    related_material_order_id,
    related_internal_document_id,
    payload_snapshot,
    requested_by,
    requested_by_name,
    submitted_at
  )
  VALUES (
    v_request_type,
    v_status,
    COALESCE(v_title, CASE v_request_type
      WHEN 'project_start' THEN '프로젝트 개시 품의'
      WHEN 'purchase_request' THEN '구매 품의'
      ELSE '지출 품의'
    END),
    v_summary,
    v_amount,
    v_priority,
    v_quote_id,
    v_project_id,
    v_material_order_id,
    v_internal_document_id,
    v_snapshot,
    v_user_id,
    v_actor_name,
    CASE WHEN v_status = 'pending' THEN now() ELSE NULL END
  )
  RETURNING id INTO v_request_id;

  INSERT INTO public.approval_request_events (
    approval_request_id,
    event_type,
    actor_id,
    actor_name,
    metadata
  )
  VALUES (
    v_request_id,
    CASE WHEN v_status = 'pending' THEN 'submitted' ELSE 'created' END,
    v_user_id,
    v_actor_name,
    v_snapshot
  );

  PERFORM public.notify_approval_reviewers(v_request_id);

  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_approval_request(_request_id UUID, _decision TEXT, _review_note TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_status TEXT;
  v_actor_name TEXT;
  request_row public.approval_requests;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF NOT (
    public.has_role(v_user_id, 'admin'::public.app_role)
    OR public.has_role(v_user_id, 'moderator'::public.app_role)
  ) THEN
    RAISE EXCEPTION '품의를 검토할 권한이 없습니다.';
  END IF;

  IF _decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION '지원하지 않는 검토 결과입니다: %', _decision;
  END IF;

  SELECT * INTO request_row
  FROM public.approval_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF request_row.id IS NULL THEN
    RAISE EXCEPTION '품의 요청을 찾을 수 없습니다.';
  END IF;

  IF request_row.status <> 'pending' THEN
    RAISE EXCEPTION '대기 중인 품의만 검토할 수 있습니다.';
  END IF;

  v_actor_name := public.get_profile_display_name(v_user_id);

  UPDATE public.approval_requests
  SET
    status = _decision,
    reviewed_by = v_user_id,
    reviewed_by_name = v_actor_name,
    reviewed_at = now(),
    review_note = _review_note,
    updated_at = now()
  WHERE id = _request_id
  RETURNING status INTO v_status;

  INSERT INTO public.approval_request_events (
    approval_request_id,
    event_type,
    actor_id,
    actor_name,
    note
  )
  VALUES (
    _request_id,
    CASE WHEN _decision = 'approved' THEN 'approved' ELSE 'rejected' END,
    v_user_id,
    v_actor_name,
    _review_note
  );

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    description,
    data,
    dedupe_key
  )
  VALUES (
    request_row.requested_by,
    CASE WHEN _decision = 'approved' THEN 'approval_approved' ELSE 'approval_rejected' END,
    CASE WHEN _decision = 'approved' THEN '품의가 승인되었습니다' ELSE '품의가 반려되었습니다' END,
    request_row.title,
    jsonb_build_object(
      'approvalRequestId', request_row.id,
      'projectId', request_row.related_project_id,
      'quoteId', request_row.related_quote_id,
      'requestType', request_row.request_type
    ),
    'approval-result:' || request_row.id::text
  )
  ON CONFLICT (user_id, type, dedupe_key) DO UPDATE
  SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    data = EXCLUDED.data,
    is_read = false;

  RETURN _request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_approval_request(_request_id UUID, _note TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_actor_name TEXT;
  request_row public.approval_requests;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT * INTO request_row
  FROM public.approval_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF request_row.id IS NULL THEN
    RAISE EXCEPTION '품의 요청을 찾을 수 없습니다.';
  END IF;

  IF NOT (
    request_row.requested_by = v_user_id
    OR public.has_role(v_user_id, 'admin'::public.app_role)
    OR public.has_role(v_user_id, 'moderator'::public.app_role)
  ) THEN
    RAISE EXCEPTION '품의를 취소할 권한이 없습니다.';
  END IF;

  IF request_row.status NOT IN ('draft', 'pending') THEN
    RAISE EXCEPTION '대기 또는 초안 품의만 취소할 수 있습니다.';
  END IF;

  v_actor_name := public.get_profile_display_name(v_user_id);

  UPDATE public.approval_requests
  SET
    status = 'cancelled',
    cancelled_at = now(),
    updated_at = now()
  WHERE id = _request_id;

  INSERT INTO public.approval_request_events (
    approval_request_id,
    event_type,
    actor_id,
    actor_name,
    note
  )
  VALUES (_request_id, 'cancelled', v_user_id, v_actor_name, _note);

  RETURN _request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_approval_request(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_approval_request(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_approval_request(UUID, TEXT) TO authenticated;

COMMENT ON TABLE public.approval_requests IS 'Internal approval requests linked to quotes, projects, material orders, and internal project documents.';
COMMENT ON TABLE public.approval_request_events IS 'Audit trail for internal approval request lifecycle events.';
