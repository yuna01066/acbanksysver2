import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20260907090000_leave_cancellation_and_integrity.sql');
const hook = read('src/hooks/useLeaveRequests.ts');
const employeePanel = read('src/components/employee/EmployeeLeavePanel.tsx');
const usageHistory = read('src/components/leave/LeaveUsageHistory.tsx');
const attendancePage = read('src/pages/AttendancePage.tsx');
const monthlyReport = read('src/components/attendance/MonthlyAttendanceReport.tsx');

for (const fragment of [
  'leave_cancellation_requests',
  "status IN ('pending', 'approved', 'rejected', 'cancelled')",
  'calculate_leave_business_days',
  'company_holidays',
  'FOR UPDATE',
  "AT TIME ZONE 'Asia/Seoul'",
  'DROP POLICY IF EXISTS "Users can delete their own pending leave requests"',
  'DROP POLICY IF EXISTS "Admins and moderators can delete leave requests"',
  'REVOKE ALL ON FUNCTION public.request_leave_cancellation',
  'GRANT EXECUTE ON FUNCTION public.request_leave_cancellation',
]) assert.ok(migration.includes(fragment), `migration missing: ${fragment}`);

for (const rpc of [
  'submit_leave_request',
  'review_leave_request',
  'cancel_pending_leave_request',
  'request_leave_cancellation',
  'review_leave_cancellation',
  'admin_cancel_leave',
  'admin_create_leave_request',
]) assert.ok(hook.includes(rpc), `hook missing RPC: ${rpc}`);

assert.doesNotMatch(hook, /from\('leave_requests'\)\.insert/);
assert.doesNotMatch(employeePanel, /\.delete\(\)/);
assert.doesNotMatch(employeePanel, /삭제된 데이터는/);
assert.match(usageHistory, /취소 요청/);
assert.match(usageHistory, /반려·취소 기록 포함/);
assert.match(attendancePage, /<LeaveManagementPage\s+embedded/);
assert.match(monthlyReport, /\.lte\('start_date',\s*endDate\)/);
assert.match(monthlyReport, /\.gte\('end_date',\s*startDate\)/);

console.log('leave/attendance priority regression checks passed');
