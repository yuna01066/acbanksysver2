
-- 전자세금계산서 관리 테이블
CREATE TABLE public.tax_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  
  -- 연결 정보
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.saved_quotes(id) ON DELETE SET NULL,
  
  -- 팝빌 관련
  popbill_nts_confirm_num TEXT,          -- 국세청 승인번호
  popbill_issue_id TEXT,                 -- 팝빌 발행 ID
  popbill_mgt_key TEXT,                  -- 팝빌 문서번호 (관리번호)
  
  -- 발행 유형
  issue_type TEXT NOT NULL DEFAULT '정발행',  -- 정발행, 역발행
  tax_type TEXT NOT NULL DEFAULT '과세',       -- 과세, 영세, 면세
  charge_direction TEXT NOT NULL DEFAULT '정과금', -- 정과금, 역과금
  purpose_type TEXT NOT NULL DEFAULT '영수',   -- 영수, 청구, 없음
  
  -- 공급자 정보
  supplier_corp_num TEXT NOT NULL,        -- 사업자번호
  supplier_corp_name TEXT,               -- 상호
  supplier_ceo_name TEXT,                -- 대표자
  supplier_addr TEXT,                    -- 주소
  supplier_biz_type TEXT,                -- 업태
  supplier_biz_class TEXT,               -- 종목
  supplier_contact_name TEXT,            -- 담당자
  supplier_email TEXT,                   -- 이메일
  supplier_tel TEXT,                     -- 전화번호
  
  -- 공급받는자 정보
  buyer_corp_num TEXT NOT NULL,           -- 사업자번호
  buyer_corp_name TEXT,                  -- 상호
  buyer_ceo_name TEXT,                   -- 대표자
  buyer_addr TEXT,                       -- 주소
  buyer_biz_type TEXT,                   -- 업태
  buyer_biz_class TEXT,                  -- 종목
  buyer_contact_name TEXT,               -- 담당자
  buyer_email TEXT,                      -- 이메일
  buyer_tel TEXT,                        -- 전화번호
  
  -- 금액 정보
  supply_cost_total NUMERIC NOT NULL DEFAULT 0,  -- 공급가액 합계
  tax_total NUMERIC NOT NULL DEFAULT 0,          -- 세액 합계
  total_amount NUMERIC NOT NULL DEFAULT 0,       -- 합계금액
  
  -- 품목 상세 (JSON 배열)
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- items 예시: [{"serialNum":1,"purchaseDT":"20250101","itemName":"패널","spec":"","qty":1,"unitCost":100000,"supplyCost":100000,"tax":10000}]
  
  -- 기타
  write_date DATE NOT NULL DEFAULT CURRENT_DATE,  -- 작성일자
  remark1 TEXT,                          -- 비고1
  remark2 TEXT,                          -- 비고2
  remark3 TEXT,                          -- 비고3
  memo TEXT,                             -- 내부 메모
  
  -- 상태
  status TEXT NOT NULL DEFAULT 'draft',  -- draft, issued, cancelled, denied, deleted
  popbill_state_code TEXT,               -- 팝빌 상태코드
  popbill_state_dt TEXT,                 -- 팝빌 상태변경일시
  
  -- 전송 이력
  sms_sent BOOLEAN DEFAULT false,
  fax_sent BOOLEAN DEFAULT false,
  email_sent BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.tax_invoices ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Admins can manage all tax invoices"
  ON public.tax_invoices FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can manage all tax invoices"
  ON public.tax_invoices FOR ALL
  USING (has_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Users can view their own tax invoices"
  ON public.tax_invoices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tax invoices"
  ON public.tax_invoices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own draft tax invoices"
  ON public.tax_invoices FOR UPDATE
  USING (auth.uid() = user_id AND status = 'draft');

-- 프로젝트 담당자도 조회 가능
CREATE POLICY "Project assignees can view project tax invoices"
  ON public.tax_invoices FOR SELECT
  USING (project_id IS NOT NULL AND is_project_assigned(project_id, auth.uid()));

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_tax_invoices_updated_at
  BEFORE UPDATE ON public.tax_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 인덱스
CREATE INDEX idx_tax_invoices_user_id ON public.tax_invoices(user_id);
CREATE INDEX idx_tax_invoices_project_id ON public.tax_invoices(project_id);
CREATE INDEX idx_tax_invoices_quote_id ON public.tax_invoices(quote_id);
CREATE INDEX idx_tax_invoices_status ON public.tax_invoices(status);
CREATE INDEX idx_tax_invoices_popbill_mgt_key ON public.tax_invoices(popbill_mgt_key);
