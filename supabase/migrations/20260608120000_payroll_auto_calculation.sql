-- Payroll auto-calculation settings, rate versions, and calculation audit.

CREATE TABLE IF NOT EXISTS public.employee_payroll_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pay_type TEXT NOT NULL DEFAULT 'monthly' CHECK (pay_type IN ('monthly', 'annual', 'hourly')),
  monthly_base_pay NUMERIC NOT NULL DEFAULT 0,
  annual_salary NUMERIC NOT NULL DEFAULT 0,
  hourly_wage NUMERIC NOT NULL DEFAULT 0,
  standard_monthly_hours NUMERIC NOT NULL DEFAULT 209,
  non_taxable_allowances JSONB NOT NULL DEFAULT '[]'::jsonb,
  fixed_allowances JSONB NOT NULL DEFAULT '[]'::jsonb,
  overtime_policy JSONB NOT NULL DEFAULT '{
    "enabled": false,
    "mode": "none",
    "fixedMonthlyAmount": 0,
    "fixedMonthlyHours": 0,
    "useAttendanceOvertime": false,
    "dailyStandardHours": 8,
    "overtimeMultiplier": 1.5,
    "nightMultiplier": 0.5,
    "holidayMultiplier": 1.5,
    "deductUnpaidAbsence": false
  }'::jsonb,
  deduction_settings JSONB NOT NULL DEFAULT '{
    "nationalPension": true,
    "healthInsurance": true,
    "longTermCare": true,
    "employmentInsurance": true,
    "incomeTax": true,
    "localIncomeTax": true
  }'::jsonb,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_payroll_profiles ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_payroll_profiles_active_user
  ON public.employee_payroll_profiles(user_id)
  WHERE status = 'active' AND effective_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_employee_payroll_profiles_user_effective
  ON public.employee_payroll_profiles(user_id, effective_from DESC);

DROP POLICY IF EXISTS "Salary managers can manage employee payroll profiles" ON public.employee_payroll_profiles;
CREATE POLICY "Salary managers can manage employee payroll profiles"
  ON public.employee_payroll_profiles FOR ALL
  USING (public.can_access_feature('finance.view_salary'))
  WITH CHECK (public.can_access_feature('finance.view_salary'));

CREATE TABLE IF NOT EXISTS public.payroll_rate_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  effective_from DATE NOT NULL,
  national_pension_rate NUMERIC NOT NULL DEFAULT 0,
  health_insurance_rate NUMERIC NOT NULL DEFAULT 0,
  long_term_care_rate NUMERIC NOT NULL DEFAULT 0,
  employment_insurance_rate NUMERIC NOT NULL DEFAULT 0,
  local_income_tax_rate NUMERIC NOT NULL DEFAULT 0.1,
  income_tax_mode TEXT NOT NULL DEFAULT 'manual_rate' CHECK (income_tax_mode IN ('manual_rate', 'flat_amount')),
  income_tax_config JSONB NOT NULL DEFAULT '{"manualRate":0,"flatAmount":0}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_rate_versions ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_rate_versions_one_active
  ON public.payroll_rate_versions(is_active)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_payroll_rate_versions_effective
  ON public.payroll_rate_versions(effective_from DESC);

DROP POLICY IF EXISTS "Salary managers can manage payroll rate versions" ON public.payroll_rate_versions;
CREATE POLICY "Salary managers can manage payroll rate versions"
  ON public.payroll_rate_versions FOR ALL
  USING (public.can_access_feature('finance.view_salary'))
  WITH CHECK (public.can_access_feature('finance.view_salary'));

INSERT INTO public.payroll_rate_versions (
  name,
  effective_from,
  local_income_tax_rate,
  income_tax_mode,
  income_tax_config,
  is_active
)
SELECT '기본 급여 요율 템플릿', CURRENT_DATE, 0.1, 'manual_rate', '{"manualRate":0,"flatAmount":0}'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM public.payroll_rate_versions);

CREATE TABLE IF NOT EXISTS public.payroll_calculation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pay_statement_id UUID REFERENCES public.pay_statements(id) ON DELETE SET NULL,
  pay_month DATE NOT NULL,
  rate_version_id UUID REFERENCES public.payroll_rate_versions(id) ON DELETE SET NULL,
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_calculation_runs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payroll_calculation_runs_user_month
  ON public.payroll_calculation_runs(user_id, pay_month DESC);

CREATE INDEX IF NOT EXISTS idx_payroll_calculation_runs_statement
  ON public.payroll_calculation_runs(pay_statement_id);

DROP POLICY IF EXISTS "Salary managers can manage payroll calculation runs" ON public.payroll_calculation_runs;
CREATE POLICY "Salary managers can manage payroll calculation runs"
  ON public.payroll_calculation_runs FOR ALL
  USING (public.can_access_feature('finance.view_salary'))
  WITH CHECK (public.can_access_feature('finance.view_salary'));

ALTER TABLE public.pay_statements
  ADD COLUMN IF NOT EXISTS calculation_run_id UUID REFERENCES public.payroll_calculation_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rate_version_id UUID REFERENCES public.payroll_rate_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS calculation_basis JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS has_manual_override BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.pay_statement_events
  ALTER COLUMN pay_statement_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pay_statements_calculation_run_id
  ON public.pay_statements(calculation_run_id);

CREATE INDEX IF NOT EXISTS idx_pay_statements_rate_version_id
  ON public.pay_statements(rate_version_id);

ALTER TABLE public.pay_statement_events
  DROP CONSTRAINT IF EXISTS pay_statement_events_event_type_check;

ALTER TABLE public.pay_statement_events
  ADD CONSTRAINT pay_statement_events_event_type_check
  CHECK (event_type IN (
    'created',
    'updated',
    'published',
    'viewed',
    'downloaded',
    'voided',
    'calculated',
    'manual_adjusted',
    'payroll_profile_updated',
    'payroll_rate_updated'
  ));

DROP TRIGGER IF EXISTS update_employee_payroll_profiles_updated_at ON public.employee_payroll_profiles;
CREATE TRIGGER update_employee_payroll_profiles_updated_at
  BEFORE UPDATE ON public.employee_payroll_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_payroll_rate_versions_updated_at ON public.payroll_rate_versions;
CREATE TRIGGER update_payroll_rate_versions_updated_at
  BEFORE UPDATE ON public.payroll_rate_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.employee_payroll_profiles IS '직원별 자동 급여 계산 기준';
COMMENT ON TABLE public.payroll_rate_versions IS '급여 공제 요율 버전. 발행된 명세서는 발행 당시 요율 스냅샷을 보존한다.';
COMMENT ON TABLE public.payroll_calculation_runs IS '급여명세 자동 계산 입력/결과 이력';
COMMENT ON COLUMN public.pay_statements.calculation_basis IS '급여명세 발행 당시 자동 계산 근거 스냅샷';
COMMENT ON COLUMN public.pay_statements.has_manual_override IS '자동 계산 결과를 관리자가 수동 조정했는지 여부';
