
-- 연차 정책 설정 테이블
CREATE TABLE public.leave_policy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_name TEXT NOT NULL DEFAULT '기본 연차 정책',
  description TEXT,
  grant_basis TEXT NOT NULL DEFAULT 'join_date',
  leave_unit TEXT NOT NULL DEFAULT 'day',
  allow_advance_use BOOLEAN NOT NULL DEFAULT false,
  grant_method TEXT NOT NULL DEFAULT 'monthly_accrual',
  auto_expire_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_expire_type TEXT NOT NULL DEFAULT 'annual_monthly',
  smart_promotion TEXT NOT NULL DEFAULT 'none',
  approver_required BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.leave_policy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage leave policies"
ON public.leave_policy_settings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can manage leave policies"
ON public.leave_policy_settings FOR ALL
USING (has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Anyone can read leave policies"
ON public.leave_policy_settings FOR SELECT
USING (true);

-- Insert default policy
INSERT INTO public.leave_policy_settings (policy_name, description, is_default)
VALUES ('기본 연차 정책', '근로기준법 제60조 기반 기본 연차 정책', true);
