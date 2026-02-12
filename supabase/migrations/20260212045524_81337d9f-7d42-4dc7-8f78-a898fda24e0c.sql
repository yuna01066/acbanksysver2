
ALTER TABLE public.leave_policy_settings 
ADD COLUMN IF NOT EXISTS approver_level text NOT NULL DEFAULT 'none';

COMMENT ON COLUMN public.leave_policy_settings.approver_level IS 'Approver level: none, manager_up, moderator_up, admin';
