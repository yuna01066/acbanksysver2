
CREATE TABLE IF NOT EXISTS public.kakao_chatbot_users (
  kakao_user_id text PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name text,
  is_active boolean NOT NULL DEFAULT true,
  allowed_actions text[] NOT NULL DEFAULT ARRAY['read']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kakao_chatbot_users_profile_unique UNIQUE (profile_id),
  CONSTRAINT kakao_chatbot_users_allowed_actions_check CHECK (
    allowed_actions <@ ARRAY['read','write','admin']::text[]
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kakao_chatbot_users TO authenticated;
GRANT ALL ON public.kakao_chatbot_users TO service_role;

ALTER TABLE public.kakao_chatbot_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage kakao_chatbot_users"
  ON public.kakao_chatbot_users
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Moderators read kakao_chatbot_users"
  ON public.kakao_chatbot_users
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'moderator'::app_role));

DROP TRIGGER IF EXISTS update_kakao_chatbot_users_updated_at ON public.kakao_chatbot_users;
CREATE TRIGGER update_kakao_chatbot_users_updated_at
  BEFORE UPDATE ON public.kakao_chatbot_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.kakao_chatbot_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kakao_user_id text,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  command_text text,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  old_value text,
  new_value text,
  result text NOT NULL DEFAULT 'success' CHECK (result IN ('success','denied','error')),
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.kakao_chatbot_audit_logs TO authenticated;
GRANT ALL ON public.kakao_chatbot_audit_logs TO service_role;

ALTER TABLE public.kakao_chatbot_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read kakao_chatbot_audit_logs"
  ON public.kakao_chatbot_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Moderators read kakao_chatbot_audit_logs"
  ON public.kakao_chatbot_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'moderator'::app_role));

CREATE INDEX IF NOT EXISTS idx_kakao_audit_actor_created
  ON public.kakao_chatbot_audit_logs (actor_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kakao_audit_target_created
  ON public.kakao_chatbot_audit_logs (target_type, target_id, created_at DESC);

NOTIFY pgrst, 'reload schema';
