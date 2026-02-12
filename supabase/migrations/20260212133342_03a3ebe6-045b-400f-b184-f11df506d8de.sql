
-- 견적서 템플릿 테이블
CREATE TABLE public.quote_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '견적서 양식',
  is_default BOOLEAN NOT NULL DEFAULT false,
  vat_option TEXT NOT NULL DEFAULT 'separate',
  discount_rate NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 견적서 템플릿 섹션 (구분)
CREATE TABLE public.quote_template_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.quote_templates(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL DEFAULT 'items',
  title TEXT NOT NULL DEFAULT '견적항목',
  display_order INT NOT NULL DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 견적서 템플릿 항목
CREATE TABLE public.quote_template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES public.quote_template_sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  description TEXT,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT '일',
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_template_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_template_items ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자 전체 접근 (회사 내부용)
CREATE POLICY "Authenticated users can view quote templates"
  ON public.quote_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert quote templates"
  ON public.quote_templates FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update quote templates"
  ON public.quote_templates FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete quote templates"
  ON public.quote_templates FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view quote template sections"
  ON public.quote_template_sections FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage quote template sections"
  ON public.quote_template_sections FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view quote template items"
  ON public.quote_template_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage quote template items"
  ON public.quote_template_items FOR ALL
  USING (auth.uid() IS NOT NULL);

-- 타임스탬프 트리거
CREATE TRIGGER update_quote_templates_updated_at
  BEFORE UPDATE ON public.quote_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
