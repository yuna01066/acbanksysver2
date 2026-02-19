
-- 박람회 관리 테이블
CREATE TABLE public.exhibitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  location TEXT,
  booth_number TEXT,
  cost NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'upcoming',
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.exhibitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view exhibitions" ON public.exhibitions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage exhibitions" ON public.exhibitions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Moderators can manage exhibitions" ON public.exhibitions FOR ALL USING (has_role(auth.uid(), 'moderator'::app_role)) WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "Users can create exhibitions" ON public.exhibitions FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own exhibitions" ON public.exhibitions FOR UPDATE USING (auth.uid() = created_by);

-- 박람회 체크리스트
CREATE TABLE public.exhibition_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exhibition_id UUID NOT NULL REFERENCES public.exhibitions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  assignee_name TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.exhibition_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view checklist" ON public.exhibition_checklist_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage checklist" ON public.exhibition_checklist_items FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Moderators can manage checklist" ON public.exhibition_checklist_items FOR ALL USING (has_role(auth.uid(), 'moderator'::app_role)) WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "Authenticated users can manage checklist items" ON public.exhibition_checklist_items FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 박람회 고객 상담 기록
CREATE TABLE public.exhibition_consultations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exhibition_id UUID NOT NULL REFERENCES public.exhibitions(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_company TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  consultation_content TEXT,
  follow_up_action TEXT,
  follow_up_status TEXT NOT NULL DEFAULT 'pending',
  consulted_by UUID NOT NULL,
  consulted_by_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.exhibition_consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view consultations" ON public.exhibition_consultations FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage consultations" ON public.exhibition_consultations FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Moderators can manage consultations" ON public.exhibition_consultations FOR ALL USING (has_role(auth.uid(), 'moderator'::app_role)) WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "Users can create consultations" ON public.exhibition_consultations FOR INSERT WITH CHECK (auth.uid() = consulted_by);
CREATE POLICY "Users can update own consultations" ON public.exhibition_consultations FOR UPDATE USING (auth.uid() = consulted_by);

-- 박람회 웹 링크 & 메모
CREATE TABLE public.exhibition_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exhibition_id UUID NOT NULL REFERENCES public.exhibitions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  memo TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.exhibition_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view links" ON public.exhibition_links FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage links" ON public.exhibition_links FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Moderators can manage links" ON public.exhibition_links FOR ALL USING (has_role(auth.uid(), 'moderator'::app_role)) WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "Authenticated users can manage links" ON public.exhibition_links FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Triggers for updated_at
CREATE TRIGGER update_exhibitions_updated_at BEFORE UPDATE ON public.exhibitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_exhibition_checklist_updated_at BEFORE UPDATE ON public.exhibition_checklist_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_exhibition_consultations_updated_at BEFORE UPDATE ON public.exhibition_consultations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_exhibition_links_updated_at BEFORE UPDATE ON public.exhibition_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
