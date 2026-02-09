
-- 문서함 카테고리 (관리자가 설정하는 수집할 서류 종류)
CREATE TABLE public.document_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_confidential BOOLEAN NOT NULL DEFAULT false,
  allow_multiple BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read document categories"
  ON public.document_categories FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage document categories"
  ON public.document_categories FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can manage document categories"
  ON public.document_categories FOR ALL
  USING (has_role(auth.uid(), 'moderator'))
  WITH CHECK (has_role(auth.uid(), 'moderator'));

-- 직원 문서 (직원이 업로드한 파일)
CREATE TABLE public.employee_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES public.document_categories(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- 직원은 자기 문서만 CRUD
CREATE POLICY "Users can view their own documents"
  ON public.employee_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upload their own documents"
  ON public.employee_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
  ON public.employee_documents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
  ON public.employee_documents FOR DELETE
  USING (auth.uid() = user_id);

-- 관리자/모더레이터는 모든 문서 열람 가능
CREATE POLICY "Admins can view all documents"
  ON public.employee_documents FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can view all documents"
  ON public.employee_documents FOR SELECT
  USING (has_role(auth.uid(), 'moderator'));

-- 스토리지 버킷 (직원 문서 저장용)
INSERT INTO storage.buckets (id, name, public) VALUES ('employee-documents', 'employee-documents', false);

-- 스토리지 RLS
CREATE POLICY "Users can upload their own employee docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'employee-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own employee docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'employee-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator')));

CREATE POLICY "Users can delete their own employee docs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'employee-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger for updated_at
CREATE TRIGGER update_document_categories_updated_at
  BEFORE UPDATE ON public.document_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_documents_updated_at
  BEFORE UPDATE ON public.employee_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
