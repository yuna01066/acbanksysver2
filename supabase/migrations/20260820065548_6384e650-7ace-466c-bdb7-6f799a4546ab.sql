BEGIN;

-- Preserve pending-row edit visibility while explicitly allowing an employee
-- to transition only their own pending request to a cancelled state.
DROP POLICY IF EXISTS "Users can update their own pending leave requests"
ON public.leave_requests;

CREATE POLICY "Users can update their own pending leave requests"
ON public.leave_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'cancelled'));

-- Keep one canonical value for an employee who has checked in but not out yet.
-- Readers retain temporary compatibility for legacy rows until this migration runs.
UPDATE public.attendance_records
SET status = 'checked_in'
WHERE status = 'present';

-- All navigation surfaces and route guards use this same role matrix. Company
-- settings remains separately protected by CompanySettingsGuard reauthentication.
INSERT INTO public.page_role_access (page_key, min_role)
VALUES
  ('/admin-settings', 'moderator'),
  ('/business-dashboard', 'admin'),
  ('/embed-code', 'moderator'),
  ('/employee-profiles', 'admin'),
  ('/error-logs', 'admin'),
  ('/jjikjjiki-event-settings', 'moderator'),
  ('/my-page', 'employee'),
  ('/quote-template-management', 'moderator'),
  ('/response-assistant', 'employee'),
  ('/response-assistant-management', 'moderator'),
  ('/review-hub', 'moderator'),
  ('/review-settings', 'moderator'),
  ('/sample-chip-inventory', 'moderator'),
  ('/storage-status', 'admin'),
  ('/tax-invoices', 'admin'),
  ('/user-statistics', 'admin'),
  ('/year-end-tax', 'employee'),
  ('/year-end-tax-admin', 'admin')
ON CONFLICT (page_key) DO NOTHING;

-- Security correction: the earlier seed exposed the approval hub to employees.
-- This is the only existing role policy intentionally tightened in place.
INSERT INTO public.page_role_access (page_key, min_role)
VALUES ('/review-hub', 'moderator')
ON CONFLICT (page_key) DO UPDATE
SET min_role = EXCLUDED.min_role;

COMMIT;