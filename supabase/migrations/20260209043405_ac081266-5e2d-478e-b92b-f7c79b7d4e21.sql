-- Contract templates table
CREATE TABLE public.contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  template_type TEXT NOT NULL DEFAULT 'labor', -- 'labor' or 'salary'
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  pay_day INTEGER DEFAULT 25,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage contract templates"
  ON public.contract_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can manage contract templates"
  ON public.contract_templates FOR ALL
  USING (has_role(auth.uid(), 'moderator'))
  WITH CHECK (has_role(auth.uid(), 'moderator'));

CREATE POLICY "Anyone can read contract templates"
  ON public.contract_templates FOR SELECT
  USING (true);

-- Employment contracts table
CREATE TABLE public.employment_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.contract_templates(id),
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, requested, signed, rejected
  contract_type TEXT NOT NULL DEFAULT 'regular', -- regular, fixed_term, part_time
  contract_date DATE NOT NULL DEFAULT CURRENT_DATE,
  birth_date DATE,
  contract_start_date DATE,
  contract_end_date DATE,
  probation_period TEXT DEFAULT '수습 없음',
  probation_start_date DATE,
  probation_end_date DATE,
  probation_salary_rate NUMERIC DEFAULT 100,
  position TEXT,
  department TEXT,
  work_type TEXT DEFAULT '고정 근무제',
  work_days TEXT DEFAULT '월,화,수,목,금요일',
  annual_salary NUMERIC,
  monthly_salary NUMERIC,
  base_pay NUMERIC,
  fixed_overtime_pay NUMERIC,
  fixed_overtime_hours NUMERIC,
  other_allowances JSONB DEFAULT '[]',
  pay_day INTEGER DEFAULT 25,
  requested_by UUID,
  requested_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employment_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all contracts"
  ON public.employment_contracts FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can manage all contracts"
  ON public.employment_contracts FOR ALL
  USING (has_role(auth.uid(), 'moderator'))
  WITH CHECK (has_role(auth.uid(), 'moderator'));

CREATE POLICY "Users can view their own contracts"
  ON public.employment_contracts FOR SELECT
  USING (auth.uid() = user_id);

-- Insert default templates
INSERT INTO public.contract_templates (name, template_type, description, pay_day)
VALUES
  ('자동 근로계약서', 'labor', '구성원 정보로 근로 계약서가 자동 생성됩니다.', 25),
  ('자동 연봉계약서', 'salary', '구성원 정보로 연봉 계약서가 자동 생성됩니다.', 25);

-- Trigger for updated_at
CREATE TRIGGER update_employment_contracts_updated_at
  BEFORE UPDATE ON public.employment_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contract_templates_updated_at
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();