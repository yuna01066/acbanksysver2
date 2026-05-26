ALTER TABLE public.page_access_permissions
  ADD COLUMN IF NOT EXISTS effect TEXT NOT NULL DEFAULT 'allow',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'page_access_permissions_effect_check') THEN
    ALTER TABLE public.page_access_permissions
      ADD CONSTRAINT page_access_permissions_effect_check CHECK (effect IN ('allow','deny'));
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_page_access_permissions_updated_at ON public.page_access_permissions;
CREATE TRIGGER update_page_access_permissions_updated_at
BEFORE UPDATE ON public.page_access_permissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_company_master()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(p.email) = 'acbank@acbank.co.kr'
  );
$$;

DROP POLICY IF EXISTS "Admins can manage page role access" ON public.page_role_access;
DROP POLICY IF EXISTS "Company master can manage page role access" ON public.page_role_access;
CREATE POLICY "Company master can manage page role access"
ON public.page_role_access FOR ALL TO authenticated
USING (public.is_company_master()) WITH CHECK (public.is_company_master());

DROP POLICY IF EXISTS "Admins can manage page access permissions" ON public.page_access_permissions;
DROP POLICY IF EXISTS "Company master can manage page access permissions" ON public.page_access_permissions;
CREATE POLICY "Company master can manage page access permissions"
ON public.page_access_permissions FOR ALL TO authenticated
USING (public.is_company_master()) WITH CHECK (public.is_company_master());

DROP POLICY IF EXISTS "Admins and moderators can manage response assistant settings" ON public.response_assistant_settings;
DROP POLICY IF EXISTS "Admins can manage response assistant settings" ON public.response_assistant_settings;
CREATE POLICY "Admins can manage response assistant settings"
ON public.response_assistant_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.settings_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  requested_by_name TEXT,
  target_area TEXT NOT NULL DEFAULT 'admin' CHECK (target_area IN ('admin','company')),
  target_table TEXT NOT NULL,
  target_key TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'upsert' CHECK (action IN ('upsert','update','delete')),
  risk_level TEXT NOT NULL DEFAULT 'high' CHECK (risk_level IN ('low','medium','high')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','applied','cancelled')),
  change_summary TEXT NOT NULL,
  before_value JSONB,
  after_value JSONB,
  review_note TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings_change_requests TO authenticated;
GRANT ALL ON public.settings_change_requests TO service_role;

ALTER TABLE public.settings_change_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_settings_change_requests_status_created
  ON public.settings_change_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_settings_change_requests_requested_by
  ON public.settings_change_requests(requested_by, created_at DESC);

DROP TRIGGER IF EXISTS update_settings_change_requests_updated_at ON public.settings_change_requests;
CREATE TRIGGER update_settings_change_requests_updated_at
BEFORE UPDATE ON public.settings_change_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.fill_settings_change_request_requester()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.requested_by IS NULL THEN NEW.requested_by := auth.uid(); END IF;
  IF NEW.requested_by_name IS NULL THEN
    SELECT p.full_name INTO NEW.requested_by_name FROM public.profiles p WHERE p.id = NEW.requested_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fill_settings_change_request_requester ON public.settings_change_requests;
CREATE TRIGGER fill_settings_change_request_requester
BEFORE INSERT ON public.settings_change_requests
FOR EACH ROW EXECUTE FUNCTION public.fill_settings_change_request_requester();

DROP POLICY IF EXISTS "Admins can manage settings change requests" ON public.settings_change_requests;
CREATE POLICY "Admins can manage settings change requests"
ON public.settings_change_requests FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "Moderators can view own settings change requests" ON public.settings_change_requests;
CREATE POLICY "Moderators can view own settings change requests"
ON public.settings_change_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'moderator'::app_role) AND requested_by = auth.uid());

DROP POLICY IF EXISTS "Moderators can create settings change requests" ON public.settings_change_requests;
CREATE POLICY "Moderators can create settings change requests"
ON public.settings_change_requests FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'moderator'::app_role) AND requested_by = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Moderators can cancel own pending settings change requests" ON public.settings_change_requests;
CREATE POLICY "Moderators can cancel own pending settings change requests"
ON public.settings_change_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'moderator'::app_role) AND requested_by = auth.uid() AND status = 'pending')
WITH CHECK (public.has_role(auth.uid(),'moderator'::app_role) AND requested_by = auth.uid() AND status IN ('pending','cancelled'));

CREATE OR REPLACE FUNCTION public.can_access_feature(_feature_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  min_role TEXT; user_rank INTEGER; min_rank INTEGER; user_effect TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  SELECT pap.effect INTO user_effect FROM public.page_access_permissions pap
    WHERE pap.page_key = _feature_key AND pap.user_id = auth.uid() LIMIT 1;
  IF user_effect = 'deny' THEN RETURN FALSE;
  ELSIF user_effect = 'allow' THEN RETURN TRUE; END IF;
  IF public.has_role(auth.uid(),'admin'::app_role) THEN user_rank := 1;
  ELSIF public.has_role(auth.uid(),'moderator'::app_role) THEN user_rank := 2;
  ELSIF public.has_role(auth.uid(),'manager'::app_role) THEN user_rank := 3;
  ELSIF public.has_role(auth.uid(),'employee'::app_role) OR public.has_role(auth.uid(),'user'::app_role) THEN user_rank := 4;
  ELSE RETURN FALSE; END IF;
  SELECT pra.min_role INTO min_role FROM public.page_role_access pra WHERE pra.page_key = _feature_key LIMIT 1;
  min_role := COALESCE(min_role,'admin');
  min_rank := CASE min_role WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 WHEN 'manager' THEN 3 ELSE 4 END;
  RETURN user_rank <= min_rank;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_supported_settings_change(_request public.settings_change_requests)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF _request.target_table = 'response_assistant_settings' THEN
    IF _request.action = 'delete' THEN
      DELETE FROM public.response_assistant_settings WHERE key = _request.target_key;
      RETURN;
    END IF;
    INSERT INTO public.response_assistant_settings (key, value, description, updated_by)
    VALUES (_request.target_key, COALESCE(_request.after_value->>'value',''), _request.after_value->>'description', auth.uid())
    ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, description=EXCLUDED.description, updated_by=EXCLUDED.updated_by, updated_at=now();
    RETURN;
  END IF;
  IF _request.target_table = 'page_role_access' THEN
    INSERT INTO public.page_role_access (page_key, min_role)
    VALUES (_request.target_key, COALESCE(_request.after_value->>'min_role','admin'))
    ON CONFLICT (page_key) DO UPDATE SET min_role=EXCLUDED.min_role, updated_at=now();
    RETURN;
  END IF;
  RAISE EXCEPTION 'Unsupported settings change target: %', _request.target_table;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_settings_change_request(_request_id UUID, _review_note TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE request_row public.settings_change_requests;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'admin role required'; END IF;
  SELECT * INTO request_row FROM public.settings_change_requests WHERE id = _request_id FOR UPDATE;
  IF request_row.id IS NULL THEN RAISE EXCEPTION 'settings change request not found'; END IF;
  IF request_row.status <> 'pending' THEN RAISE EXCEPTION 'settings change request is not pending'; END IF;
  PERFORM public.apply_supported_settings_change(request_row);
  UPDATE public.settings_change_requests
  SET status='applied', review_note=_review_note, reviewed_by=auth.uid(), reviewed_at=now(), applied_at=now()
  WHERE id = _request_id;
  RETURN _request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_settings_change_request(_request_id UUID, _review_note TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'admin role required'; END IF;
  UPDATE public.settings_change_requests
  SET status='rejected', review_note=_review_note, reviewed_by=auth.uid(), reviewed_at=now()
  WHERE id = _request_id AND status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'pending settings change request not found'; END IF;
  RETURN _request_id;
END;
$$;

INSERT INTO public.page_role_access (page_key, min_role)
VALUES
  ('/admin-settings','moderator'),
  ('/company-settings','admin'),
  ('/quote-wizard','employee'),
  ('/meeting-reservations','manager'),
  ('system.manage_response_assistant','moderator'),
  ('system.manage_operational_settings','moderator'),
  ('company.view_sensitive_settings','admin')
ON CONFLICT (page_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';