-- Storage buckets private
UPDATE storage.buckets
SET public = false
WHERE id IN (
  'quote-pdfs','quote-attachments','internal-project-docs','employee-contracts',
  'employee-documents','portfolio-thumbnails','avatars','team-chat-attachments'
);

DROP POLICY IF EXISTS "Public read access for quote PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload quote PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update quote PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete quote PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own quote PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own quote PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own quote PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own quote PDFs" ON storage.objects;

CREATE POLICY "Users can upload own quote PDFs" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'quote-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own quote PDFs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'quote-pdfs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'moderator'::app_role)));

CREATE POLICY "Users can update own quote PDFs" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'quote-pdfs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'moderator'::app_role)))
WITH CHECK (bucket_id = 'quote-pdfs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'moderator'::app_role)));

CREATE POLICY "Users can delete own quote PDFs" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'quote-pdfs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'moderator'::app_role)));

DROP POLICY IF EXISTS "Authenticated users can upload internal docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view internal docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete internal docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their internal docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own internal project docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own internal project docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own internal project docs" ON storage.objects;

CREATE POLICY "Users can upload own internal project docs" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'internal-project-docs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'moderator'::app_role)));

CREATE POLICY "Users can view own internal project docs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'internal-project-docs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'moderator'::app_role)));

CREATE POLICY "Users can delete own internal project docs" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'internal-project-docs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'moderator'::app_role)));

DROP POLICY IF EXISTS "Anyone can view team chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload team chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own team chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own team chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view team chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own team chat attachments" ON storage.objects;

CREATE POLICY "Users can upload own team chat attachments" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'team-chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can view team chat attachments" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'team-chat-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own team chat attachments" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'team-chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Password reset requests: remove client insert
DROP POLICY IF EXISTS "Anyone can create password reset requests" ON public.password_reset_requests;
DROP POLICY IF EXISTS "Authenticated users can create password reset requests" ON public.password_reset_requests;

-- Notifications
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins and moderators can insert notifications" ON public.notifications;

CREATE POLICY "Users can insert own notifications" ON public.notifications FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins and moderators can insert notifications" ON public.notifications FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'moderator'::app_role));

-- Realtime
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can receive app realtime topics" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send app realtime topics" ON realtime.messages;

CREATE POLICY "Authenticated users can receive app realtime topics" ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.topic() IN ('employee-status','team-chat','user-notifications','dm-list-refresh','panel-sizes-changes','meeting-requests-popup','home-channel-talk-inquiries')
  OR (realtime.topic() ~ '^dm-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND strpos(realtime.topic(), auth.uid()::text) > 0)
  OR (CASE WHEN realtime.topic() ~ '^project-updates-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'moderator'::app_role)
    OR public.is_project_owner(replace(realtime.topic(),'project-updates-','')::uuid, auth.uid())
    OR public.is_project_assigned(replace(realtime.topic(),'project-updates-','')::uuid, auth.uid())
  ELSE false END)
);

CREATE POLICY "Authenticated users can send app realtime topics" ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  realtime.topic() IN ('employee-status','team-chat','user-notifications','dm-list-refresh','panel-sizes-changes','meeting-requests-popup','home-channel-talk-inquiries')
  OR (realtime.topic() ~ '^dm-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND strpos(realtime.topic(), auth.uid()::text) > 0)
  OR (CASE WHEN realtime.topic() ~ '^project-updates-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'moderator'::app_role)
    OR public.is_project_owner(replace(realtime.topic(),'project-updates-','')::uuid, auth.uid())
    OR public.is_project_assigned(replace(realtime.topic(),'project-updates-','')::uuid, auth.uid())
  ELSE false END)
);

-- Revoke execute on trigger-only/maintenance SECURITY DEFINER functions
DO $$
DECLARE fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    to_regprocedure('public.update_updated_at_column()'),
    to_regprocedure('public.handle_new_user()'),
    to_regprocedure('public.fill_settings_change_request_requester()'),
    to_regprocedure('public.apply_supported_settings_change(public.settings_change_requests)'),
    to_regprocedure('public.enforce_profile_self_service_fields()'),
    to_regprocedure('public.apply_profile_change_request()'),
    to_regprocedure('public.notify_admins_for_hr_request()'),
    to_regprocedure('public.notify_admins_for_profile_change_request()'),
    to_regprocedure('public.cleanup_expired_quote_wizard_data()'),
    to_regprocedure('public.cleanup_expired_quote_wizard_rows()')
  ]
  LOOP
    IF fn IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';