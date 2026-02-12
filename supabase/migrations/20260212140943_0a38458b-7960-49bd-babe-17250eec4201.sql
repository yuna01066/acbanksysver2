
-- 매출/매입 구분 컬럼 추가
ALTER TABLE public.tax_invoices 
  ADD COLUMN IF NOT EXISTS invoice_direction text NOT NULL DEFAULT 'sales';
-- sales = 매출, purchase = 매입

-- 수신처 연동
ALTER TABLE public.tax_invoices 
  ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES public.recipients(id) ON DELETE SET NULL;

-- 견적서 연동 (이미 quote_id 존재하지만 FK 확인)
-- quote_id already exists

-- 프로젝트 연동 (이미 project_id 존재하지만 FK 확인)  
-- project_id already exists

-- 견적서명, 프로젝트명 캐시 (조회 편의)
ALTER TABLE public.tax_invoices
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS project_name text,
  ADD COLUMN IF NOT EXISTS quote_number text;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_tax_invoices_direction ON public.tax_invoices(invoice_direction);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_recipient ON public.tax_invoices(recipient_id);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_project ON public.tax_invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_write_date ON public.tax_invoices(write_date);
