
-- 연말정산 메인 테이블 (연도별 직원 정산 기록)
CREATE TABLE public.year_end_tax_settlements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  tax_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE) - 1,
  
  -- 근로소득 정보
  total_salary NUMERIC DEFAULT 0,
  total_tax_paid NUMERIC DEFAULT 0,
  total_local_tax_paid NUMERIC DEFAULT 0,
  
  -- 결과
  estimated_tax NUMERIC DEFAULT 0,
  estimated_refund NUMERIC DEFAULT 0,
  final_tax NUMERIC DEFAULT 0,
  final_refund NUMERIC DEFAULT 0,
  
  -- 분납 설정
  installment_enabled BOOLEAN DEFAULT false,
  installment_months INTEGER DEFAULT 1,
  
  -- 워크플로우
  status TEXT NOT NULL DEFAULT 'not_started',
  -- not_started, in_progress, submitted, review, revision_requested, confirmed, finalized
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  review_comment TEXT,
  confirmed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, tax_year)
);

ALTER TABLE public.year_end_tax_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settlements" ON public.year_end_tax_settlements
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own settlements" ON public.year_end_tax_settlements
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own non-finalized settlements" ON public.year_end_tax_settlements
  FOR UPDATE USING (auth.uid() = user_id AND status NOT IN ('finalized'));
CREATE POLICY "Admins can manage all settlements" ON public.year_end_tax_settlements
  FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderators can manage all settlements" ON public.year_end_tax_settlements
  FOR ALL USING (has_role(auth.uid(), 'moderator')) WITH CHECK (has_role(auth.uid(), 'moderator'));

-- 부양가족 테이블
CREATE TABLE public.tax_dependents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  settlement_id UUID NOT NULL REFERENCES public.year_end_tax_settlements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  name TEXT NOT NULL,
  relationship TEXT NOT NULL, -- 배우자, 직계존속, 직계비속, 형제자매, 기타
  resident_number TEXT, -- 주민번호 (마스킹 저장)
  birth_date DATE,
  is_disabled BOOLEAN DEFAULT false,
  disability_type TEXT, -- 장애인, 상이(국가유공), 항시치료
  is_senior BOOLEAN DEFAULT false, -- 경로우대 (70세 이상)
  is_child_under6 BOOLEAN DEFAULT false, -- 6세 이하
  is_single_parent BOOLEAN DEFAULT false, -- 한부모
  is_woman_deduction BOOLEAN DEFAULT false, -- 부녀자
  has_income_limit BOOLEAN DEFAULT true, -- 소득요건 충족 여부
  basic_deduction BOOLEAN DEFAULT true, -- 기본공제 적용
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_dependents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own dependents" ON public.tax_dependents
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all dependents" ON public.tax_dependents
  FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderators can manage all dependents" ON public.tax_dependents
  FOR ALL USING (has_role(auth.uid(), 'moderator')) WITH CHECK (has_role(auth.uid(), 'moderator'));

-- 공제항목 테이블
CREATE TABLE public.tax_deduction_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  settlement_id UUID NOT NULL REFERENCES public.year_end_tax_settlements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  category TEXT NOT NULL,
  -- insurance: 보험료 (건강보험, 고용보험, 보장성보험, 장애인전용보험)
  -- medical: 의료비 (일반, 난임, 미숙아, 장애인, 65세이상, 본인)
  -- education: 교육비 (본인, 취학전, 초중고, 대학교, 장애인특수교육, 학자금대출)
  -- housing: 주택자금 (주택청약, 주택임차차입금, 장기주택저당차입금)
  -- donation: 기부금 (법정, 정치자금, 종교단체, 지정)
  -- credit_card: 신용카드 등 (신용카드, 체크카드, 현금영수증, 도서공연, 전통시장, 대중교통)
  -- pension: 연금 (국민연금, 개인연금저축, 연금계좌)
  -- other: 기타 (월세, 소기업공제, 투자조합출자)
  
  sub_category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  dependent_id UUID REFERENCES public.tax_dependents(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_deduction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own deduction items" ON public.tax_deduction_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all deduction items" ON public.tax_deduction_items
  FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderators can manage all deduction items" ON public.tax_deduction_items
  FOR ALL USING (has_role(auth.uid(), 'moderator')) WITH CHECK (has_role(auth.uid(), 'moderator'));

-- 연말정산 서류 업로드 테이블
CREATE TABLE public.tax_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  settlement_id UUID NOT NULL REFERENCES public.year_end_tax_settlements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  document_type TEXT NOT NULL,
  -- hometax_pdf: 국세청 간소화 PDF
  -- medical_receipt: 의료비 영수증
  -- education_receipt: 교육비 납입증명서
  -- donation_receipt: 기부금 영수증
  -- housing_doc: 주택 관련 서류
  -- disability_doc: 장애인증명서
  -- other: 기타 증빙서류
  
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  memo TEXT,
  
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own tax documents" ON public.tax_documents
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all tax documents" ON public.tax_documents
  FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderators can manage all tax documents" ON public.tax_documents
  FOR ALL USING (has_role(auth.uid(), 'moderator')) WITH CHECK (has_role(auth.uid(), 'moderator'));

-- 스토리지 버킷
INSERT INTO storage.buckets (id, name, public) VALUES ('tax-documents', 'tax-documents', false);

CREATE POLICY "Users can upload their own tax docs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'tax-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view their own tax docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'tax-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own tax docs" ON storage.objects
  FOR DELETE USING (bucket_id = 'tax-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Admins can view all tax docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'tax-documents' AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderators can view all tax docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'tax-documents' AND has_role(auth.uid(), 'moderator'));

-- 트리거
CREATE TRIGGER update_year_end_tax_settlements_updated_at
  BEFORE UPDATE ON public.year_end_tax_settlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tax_dependents_updated_at
  BEFORE UPDATE ON public.tax_dependents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tax_deduction_items_updated_at
  BEFORE UPDATE ON public.tax_deduction_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
