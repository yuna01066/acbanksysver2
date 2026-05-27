ALTER TABLE public.channel_talk_quote_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view channel talk quote leads" ON public.channel_talk_quote_leads;
DROP POLICY IF EXISTS "Admins and moderators can view channel talk quote leads" ON public.channel_talk_quote_leads;
DROP POLICY IF EXISTS "Managers can view assigned channel talk quote leads" ON public.channel_talk_quote_leads;
CREATE POLICY "Managers can view assigned channel talk quote leads"
ON public.channel_talk_quote_leads FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
  OR assigned_to = auth.uid()
);

ALTER TABLE public.exhibition_consultations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view consultations" ON public.exhibition_consultations;
DROP POLICY IF EXISTS "Users can view own consultations" ON public.exhibition_consultations;
DROP POLICY IF EXISTS "Admins and moderators can view consultations" ON public.exhibition_consultations;
CREATE POLICY "Users can view own consultations"
ON public.exhibition_consultations FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
  OR consulted_by = auth.uid()
);

ALTER TABLE public.imweb_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.imweb_orders;
DROP POLICY IF EXISTS "Admins and moderators can view orders" ON public.imweb_orders;
CREATE POLICY "Admins and moderators can view orders"
ON public.imweb_orders FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);

ALTER TABLE public.recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view all recipients" ON public.recipients;
DROP POLICY IF EXISTS "Users can view relevant recipients" ON public.recipients;
CREATE POLICY "Users can view relevant recipients"
ON public.recipients FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.recipient_id = recipients.id
      AND (p.user_id = auth.uid() OR public.is_project_assigned(p.id, auth.uid()))
  )
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read basic profiles" ON public.profiles;
DROP POLICY IF EXISTS "Moderators can view all profiles" ON public.profiles;
CREATE POLICY "Moderators can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'moderator'::app_role));

DROP POLICY IF EXISTS "Anyone can read company holidays" ON public.company_holidays;
DROP POLICY IF EXISTS "Authenticated users can read company holidays" ON public.company_holidays;
CREATE POLICY "Authenticated users can read company holidays"
ON public.company_holidays FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can read contract templates" ON public.contract_templates;
DROP POLICY IF EXISTS "Authenticated users can read contract templates" ON public.contract_templates;
CREATE POLICY "Authenticated users can read contract templates"
ON public.contract_templates FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can read document categories" ON public.document_categories;
DROP POLICY IF EXISTS "Authenticated users can read document categories" ON public.document_categories;
CREATE POLICY "Authenticated users can read document categories"
ON public.document_categories FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can read labor law settings" ON public.labor_law_settings;
DROP POLICY IF EXISTS "Authenticated users can read labor law settings" ON public.labor_law_settings;
CREATE POLICY "Authenticated users can read labor law settings"
ON public.labor_law_settings FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can read leave general settings" ON public.leave_general_settings;
DROP POLICY IF EXISTS "Authenticated users can read leave general settings" ON public.leave_general_settings;
CREATE POLICY "Authenticated users can read leave general settings"
ON public.leave_general_settings FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can read leave policies" ON public.leave_policy_settings;
DROP POLICY IF EXISTS "Authenticated users can read leave policies" ON public.leave_policy_settings;
CREATE POLICY "Authenticated users can read leave policies"
ON public.leave_policy_settings FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can read review categories" ON public.performance_review_categories;
DROP POLICY IF EXISTS "Authenticated users can read review categories" ON public.performance_review_categories;
CREATE POLICY "Authenticated users can read review categories"
ON public.performance_review_categories FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view document files" ON public.document_files;
DROP POLICY IF EXISTS "Users can view relevant document files" ON public.document_files;
CREATE POLICY "Users can view relevant document files"
ON public.document_files FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
  OR uploaded_by = auth.uid()
  OR (quote_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.saved_quotes sq
    WHERE sq.id = document_files.quote_id
      AND (sq.user_id = auth.uid() OR sq.issuer_id = auth.uid() OR sq.assigned_to = auth.uid())
  ))
  OR (project_id IS NOT NULL AND (
    public.is_project_owner(project_id, auth.uid())
    OR public.is_project_assigned(project_id, auth.uid())
  ))
  OR (recipient_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.recipients r
    WHERE r.id = document_files.recipient_id AND r.user_id = auth.uid()
  ))
);

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can receive app realtime topics" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send app realtime topics" ON realtime.messages;
CREATE POLICY "Authenticated users can receive app realtime topics"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.topic() IN (
    'employee-status','team-chat','dm-list-refresh','panel-sizes-changes',
    'meeting-requests-popup','home-channel-talk-inquiries'
  )
  OR (
    realtime.topic() ~ '^user-notifications-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND realtime.topic() = 'user-notifications-' || auth.uid()::text
  )
  OR (
    realtime.topic() ~ '^dm-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND strpos(realtime.topic(), auth.uid()::text) > 0
  )
  OR (
    CASE WHEN realtime.topic() ~ '^project-updates-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'moderator'::app_role)
      OR public.is_project_owner(replace(realtime.topic(), 'project-updates-', '')::uuid, auth.uid())
      OR public.is_project_assigned(replace(realtime.topic(), 'project-updates-', '')::uuid, auth.uid())
    ELSE false END
  )
);
CREATE POLICY "Authenticated users can send app realtime topics"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  realtime.topic() IN (
    'employee-status','team-chat','dm-list-refresh','panel-sizes-changes',
    'meeting-requests-popup','home-channel-talk-inquiries'
  )
  OR (
    realtime.topic() ~ '^user-notifications-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND realtime.topic() = 'user-notifications-' || auth.uid()::text
  )
  OR (
    realtime.topic() ~ '^dm-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND strpos(realtime.topic(), auth.uid()::text) > 0
  )
  OR (
    CASE WHEN realtime.topic() ~ '^project-updates-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'moderator'::app_role)
      OR public.is_project_owner(replace(realtime.topic(), 'project-updates-', '')::uuid, auth.uid())
      OR public.is_project_assigned(replace(realtime.topic(), 'project-updates-', '')::uuid, auth.uid())
    ELSE false END
  )
);

DO $$
DECLARE fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
  END LOOP;
END $$;

DO $$
DECLARE fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    to_regprocedure('public.has_role(uuid, public.app_role)'),
    to_regprocedure('public.is_project_owner(uuid, uuid)'),
    to_regprocedure('public.is_project_assigned(uuid, uuid)'),
    to_regprocedure('public.check_workplace_distance(double precision, double precision)'),
    to_regprocedure('public.approve_settings_change_request(uuid, text)'),
    to_regprocedure('public.reject_settings_change_request(uuid, text)')
  ]
  LOOP
    IF fn IS NOT NULL THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';