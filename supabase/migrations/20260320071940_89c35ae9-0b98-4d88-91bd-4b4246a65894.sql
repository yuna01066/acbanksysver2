
-- 연차 추가 부여/차감 테이블
CREATE TABLE public.leave_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  adjustment_type TEXT NOT NULL DEFAULT 'grant', -- 'grant' (부여) or 'deduct' (차감)
  days NUMERIC(5,1) NOT NULL,
  leave_category TEXT NOT NULL DEFAULT 'annual', -- 'annual', 'monthly', 'special' etc.
  reason TEXT,
  granted_by UUID NOT NULL,
  granted_by_name TEXT NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at DATE, -- optional expiration
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_adjustments ENABLE ROW LEVEL SECURITY;

-- Admins/moderators can do everything
CREATE POLICY "Admins can manage leave adjustments"
ON public.leave_adjustments
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
);

-- Users can view their own adjustments
CREATE POLICY "Users can view own adjustments"
ON public.leave_adjustments
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_leave_adjustments_updated_at
BEFORE UPDATE ON public.leave_adjustments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
