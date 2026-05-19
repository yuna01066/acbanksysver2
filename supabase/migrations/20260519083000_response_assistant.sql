CREATE TABLE public.response_knowledge_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.response_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_channel TEXT NOT NULL DEFAULT 'email',
  external_thread_id TEXT,
  external_message_id TEXT,
  customer_company TEXT,
  customer_name TEXT,
  customer_contact TEXT,
  inquiry_type TEXT NOT NULL DEFAULT 'general',
  customer_message TEXT NOT NULL,
  internal_context TEXT,
  related_quote_id UUID REFERENCES public.saved_quotes(id) ON DELETE SET NULL,
  related_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  risk_level TEXT NOT NULL DEFAULT 'normal',
  review_required BOOLEAN NOT NULL DEFAULT false,
  final_response TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.response_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.response_cases(id) ON DELETE CASCADE,
  selected_tone TEXT NOT NULL DEFAULT 'firm',
  drafts_by_tone JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT,
  persuasion_points TEXT[] NOT NULL DEFAULT '{}',
  empathy_points TEXT[] NOT NULL DEFAULT '{}',
  avoid_phrases TEXT[] NOT NULL DEFAULT '{}',
  used_knowledge_item_ids UUID[] NOT NULL DEFAULT '{}',
  ai_risk_level TEXT NOT NULL DEFAULT 'normal',
  review_required BOOLEAN NOT NULL DEFAULT false,
  final_text TEXT,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_response_cases_created_by_created_at
  ON public.response_cases(created_by, created_at DESC);

CREATE INDEX idx_response_cases_status_created_at
  ON public.response_cases(status, created_at DESC);

CREATE INDEX idx_response_cases_external_thread
  ON public.response_cases(source_channel, external_thread_id);

CREATE INDEX idx_response_drafts_case_id_created_at
  ON public.response_drafts(case_id, created_at DESC);

CREATE INDEX idx_response_knowledge_items_active_category
  ON public.response_knowledge_items(is_active, category);

ALTER TABLE public.response_knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active response knowledge"
ON public.response_knowledge_items
FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE POLICY "Admins and moderators can manage response knowledge"
ON public.response_knowledge_items
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);

CREATE POLICY "Users can view own response cases"
ON public.response_cases
FOR SELECT
USING (
  created_by = auth.uid()
  OR assigned_to = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);

CREATE POLICY "Users can create own response cases"
ON public.response_cases
FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update visible response cases"
ON public.response_cases
FOR UPDATE
USING (
  created_by = auth.uid()
  OR assigned_to = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
)
WITH CHECK (
  created_by = auth.uid()
  OR assigned_to = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);

CREATE POLICY "Users can view response drafts for visible cases"
ON public.response_drafts
FOR SELECT
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.response_cases rc
    WHERE rc.id = response_drafts.case_id
      AND (
        rc.created_by = auth.uid()
        OR rc.assigned_to = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'moderator'::app_role)
      )
  )
);

CREATE POLICY "Users can create own response drafts"
ON public.response_drafts
FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update response drafts for visible cases"
ON public.response_drafts
FOR UPDATE
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.response_cases rc
    WHERE rc.id = response_drafts.case_id
      AND (
        rc.created_by = auth.uid()
        OR rc.assigned_to = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'moderator'::app_role)
      )
  )
)
WITH CHECK (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.response_cases rc
    WHERE rc.id = response_drafts.case_id
      AND (
        rc.created_by = auth.uid()
        OR rc.assigned_to = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'moderator'::app_role)
      )
  )
);

CREATE TRIGGER update_response_knowledge_items_updated_at
BEFORE UPDATE ON public.response_knowledge_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_response_cases_updated_at
BEFORE UPDATE ON public.response_cases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_response_drafts_updated_at
BEFORE UPDATE ON public.response_drafts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.response_knowledge_items (title, category, content, is_active)
VALUES
  (
    '원자재 가격 상승 안내',
    'pricing',
    '최근 전쟁 여파와 수급 불안정으로 주요 원자재 금액이 약 20% 상승했습니다. 고객에게는 단정적인 책임 전가보다 시장 상황과 제작 원가 반영이라는 표현을 사용합니다.',
    true
  ),
  (
    '무기포 접착 단가 설명',
    'processing',
    '무기포 접착은 일반 접착보다 공정 난이도와 작업 시간이 커 일반 접착 대비 약 3배 수준의 공정 단가가 발생할 수 있습니다. 견적 방어 시 사양 기준 산출 단가임을 설명합니다.',
    true
  ),
  (
    '가격 항의 응대 원칙',
    'complaint',
    '고객의 부담감은 먼저 인정하되, 평균 단가가 아니라 요청 사양과 제작 방식 기준의 산출 금액임을 분명히 설명합니다. 조정 가능 사양이 있으면 대안을 함께 제안합니다.',
    true
  );
