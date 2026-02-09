
-- Global leave settings (not per-policy)
CREATE TABLE public.leave_general_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.leave_general_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage leave general settings" ON public.leave_general_settings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Moderators can manage leave general settings" ON public.leave_general_settings FOR ALL USING (has_role(auth.uid(), 'moderator'::app_role)) WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "Anyone can read leave general settings" ON public.leave_general_settings FOR SELECT USING (true);

-- Seed defaults
INSERT INTO public.leave_general_settings (setting_key, setting_value) VALUES
('resignation_adjustment', '{"basis": "favorable_to_employee"}'::jsonb),
('leave_promotion', '{"approval_target": "none", "member_reminder": false, "admin_reminder": false, "plan_notification_days": 10, "annual_promotion_timing": "6months_before", "monthly_1st_timing": "3months_before", "monthly_2nd_timing": "1month_before"}'::jsonb);
