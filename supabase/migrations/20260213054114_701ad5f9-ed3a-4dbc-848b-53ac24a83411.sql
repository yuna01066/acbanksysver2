
-- 내부 프로젝트 문서 테이블 (견적서/영수증)
CREATE TABLE public.internal_project_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('quote', 'receipt')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  
  -- OCR 추출 결과
  ocr_result JSONB DEFAULT '{}'::jsonb,
  vendor_name TEXT,
  vendor_phone TEXT,
  vendor_business_number TEXT,
  purchase_date DATE,
  
  -- 금액 정보
  items JSONB DEFAULT '[]'::jsonb,
  subtotal NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  
  -- 입금 처리
  is_paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.internal_project_documents ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Admins can manage all internal documents"
  ON public.internal_project_documents FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can manage all internal documents"
  ON public.internal_project_documents FOR ALL
  USING (has_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Project owners can manage their documents"
  ON public.internal_project_documents FOR ALL
  USING (is_project_owner(project_id, auth.uid()))
  WITH CHECK (is_project_owner(project_id, auth.uid()));

CREATE POLICY "Project assignees can view documents"
  ON public.internal_project_documents FOR SELECT
  USING (is_project_assigned(project_id, auth.uid()));

CREATE POLICY "Users can insert their own documents"
  ON public.internal_project_documents FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);

-- 타임스탬프 트리거
CREATE TRIGGER update_internal_project_documents_updated_at
  BEFORE UPDATE ON public.internal_project_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 스토리지 버킷
INSERT INTO storage.buckets (id, name, public) VALUES ('internal-project-docs', 'internal-project-docs', false);

CREATE POLICY "Authenticated users can upload internal docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'internal-project-docs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view internal docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'internal-project-docs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their internal docs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'internal-project-docs' AND auth.uid() IS NOT NULL);
