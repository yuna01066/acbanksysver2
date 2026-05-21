
-- Response Assistant tables
CREATE TABLE IF NOT EXISTS public.response_assistant_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.response_knowledge_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  content text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.response_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_channel text NOT NULL DEFAULT 'email',
  external_thread_id text,
  external_message_id text,
  customer_company text,
  customer_name text,
  customer_contact text,
  inquiry_type text,
  customer_message text NOT NULL,
  internal_context text,
  related_quote_id uuid,
  related_project_id uuid,
  assigned_to uuid,
  status text NOT NULL DEFAULT 'draft',
  risk_level text NOT NULL DEFAULT 'normal',
  review_required boolean NOT NULL DEFAULT false,
  final_response text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.response_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.response_cases(id) ON DELETE CASCADE,
  selected_tone text NOT NULL DEFAULT 'firm',
  drafts_by_tone jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  persuasion_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  empathy_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  avoid_phrases jsonb NOT NULL DEFAULT '[]'::jsonb,
  used_knowledge_item_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_risk_level text NOT NULL DEFAULT 'normal',
  review_required boolean NOT NULL DEFAULT false,
  final_text text,
  is_used boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.response_assistant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_drafts ENABLE ROW LEVEL SECURITY;

-- Settings: admin/moderator manage; authenticated read
CREATE POLICY "settings_read_auth" ON public.response_assistant_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_manage_admin" ON public.response_assistant_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- Knowledge items: authenticated read; admin/mod manage
CREATE POLICY "knowledge_read_auth" ON public.response_knowledge_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "knowledge_manage_admin" ON public.response_knowledge_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- Cases: creator/assignee/manager can read & update
CREATE POLICY "cases_read" ON public.response_cases
  FOR SELECT TO authenticated USING (
    created_by = auth.uid() OR assigned_to = auth.uid()
    OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')
  );
CREATE POLICY "cases_insert" ON public.response_cases
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR created_by IS NULL);
CREATE POLICY "cases_update" ON public.response_cases
  FOR UPDATE TO authenticated USING (
    created_by = auth.uid() OR assigned_to = auth.uid()
    OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')
  );
CREATE POLICY "cases_delete_admin" ON public.response_cases
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')
  );

-- Drafts: same access as parent case via creator/manager
CREATE POLICY "drafts_read" ON public.response_drafts
  FOR SELECT TO authenticated USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')
    OR EXISTS (SELECT 1 FROM public.response_cases c WHERE c.id = case_id AND (c.created_by = auth.uid() OR c.assigned_to = auth.uid()))
  );
CREATE POLICY "drafts_insert" ON public.response_drafts
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR created_by IS NULL);
CREATE POLICY "drafts_update" ON public.response_drafts
  FOR UPDATE TO authenticated USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')
    OR EXISTS (SELECT 1 FROM public.response_cases c WHERE c.id = case_id AND (c.created_by = auth.uid() OR c.assigned_to = auth.uid()))
  );
CREATE POLICY "drafts_delete_admin" ON public.response_drafts
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')
  );

CREATE TRIGGER response_assistant_settings_updated_at BEFORE UPDATE ON public.response_assistant_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER response_knowledge_items_updated_at BEFORE UPDATE ON public.response_knowledge_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER response_cases_updated_at BEFORE UPDATE ON public.response_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER response_drafts_updated_at BEFORE UPDATE ON public.response_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
