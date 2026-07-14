
-- Restrict reads to approved users for internal HR/finance/directory tables

DROP POLICY IF EXISTS "Authenticated users can read checked in employee status" ON public.checked_in_employee_status;
CREATE POLICY "Approved users can read checked in employee status"
ON public.checked_in_employee_status
FOR SELECT TO authenticated
USING (public.is_approved_user() AND date = ((now() AT TIME ZONE 'Asia/Seoul')::date));

DROP POLICY IF EXISTS "Anyone authenticated can view custom leave types" ON public.custom_leave_types;
CREATE POLICY "Approved users can view custom leave types"
ON public.custom_leave_types
FOR SELECT TO authenticated
USING (public.is_approved_user());

DROP POLICY IF EXISTS "Authenticated users can read labor law settings" ON public.labor_law_settings;
CREATE POLICY "Approved users can read labor law settings"
ON public.labor_law_settings
FOR SELECT TO authenticated
USING (public.is_approved_user());

DROP POLICY IF EXISTS "Authenticated users can read leave policies" ON public.leave_policy_settings;
CREATE POLICY "Approved users can read leave policies"
ON public.leave_policy_settings
FOR SELECT TO authenticated
USING (public.is_approved_user());

DROP POLICY IF EXISTS "Authenticated users can read company quote defaults" ON public.company_quote_defaults;
CREATE POLICY "Approved users can read company quote defaults"
ON public.company_quote_defaults
FOR SELECT TO authenticated
USING (public.is_approved_user());

DROP POLICY IF EXISTS "Authenticated users can read profile directory" ON public.profile_directory;
CREATE POLICY "Approved users can read profile directory"
ON public.profile_directory
FOR SELECT TO authenticated
USING (public.is_approved_user());
