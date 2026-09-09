import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const root = fileURLToPath(new URL('../', import.meta.url));
const notificationSource = readFileSync(root + 'src/hooks/useTodayWorkItems.tsx', 'utf8');
const notificationPath = notificationSource.slice(notificationSource.indexOf('export function getNotificationPath'), notificationSource.indexOf('\nfunction getNotificationSourceKey'));
const bundle = await build({
  stdin: { contents: "export * from './src/lib/readAllRows'; export * from './src/lib/leaveBalance'; export * from './src/lib/attendanceHubRoute'; export * from './src/lib/attendanceLeaveQueries';" + notificationPath, loader: 'ts', resolveDir: root },
  bundle: true, write: false, platform: 'node', format: 'esm', alias: { '@': root + 'src' },
});
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const NativeDate = Date;
globalThis.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : ['2026-09-09T03:00:00Z'])); }
  static now() { return new NativeDate('2026-09-09T03:00:00Z').getTime(); }
};
try {
  assert.equal(api.getNotificationPath({ type: 'leave_request', data: { leaveRequestId: 'a' } }), '/attendance?scope=all&tab=approvals&request=a');
  assert.equal(api.getNotificationPath({ type: 'leave_approved', data: { leave_request_id: 'a' } }), '/attendance?scope=my&tab=leave&request=a');
  assert.equal(api.getNotificationPath({ type: 'attendance_correction_request', data: { requestId: 'a' } }), '/attendance?scope=all&tab=approvals&kind=attendance&request=a');
  assert.equal(api.getNotificationPath({ type: 'system', data: { url: '/attendance?scope=my&tab=attendance', requestId: 'a' } }), '/attendance?scope=my&tab=attendance&request=a');
  assert.equal(api.getNotificationPath({ type: 'system', data: { url: 'https://untrusted.example' } }), '/');
  const historical = Array.from({ length: 1205 }, (_, id) => ({ id }));
  assert.deepEqual(await api.readAllRows({ range: async (from, to) => ({ data: historical.slice(from, to + 1), error: null }) }), historical);
  await assert.rejects(api.readAllRows({ range: async () => ({ data: null, error: new Error('offline') }) }), /offline/);
  const policy = { grant_method: 'monthly_accrual', grant_basis: 'join_date', auto_expire_enabled: false, auto_expire_type: 'none' };
  const request = (id, type, status, days, start = '2026-08-01') => ({ id, user_id: 'employee', leave_type: type, status, days, start_date: start, end_date: start });
  const requests = [
    request('1', 'annual', 'approved', 1), request('2', 'half_am', 'approved', 0.5, '2026-10-01'),
    request('3', 'monthly', 'pending', 1), request('4', 'annual', 'cancelled', 2),
    request('5', 'annual', 'rejected', 3), request('6', 'summer', 'approved', 3),
    request('7', 'half_pm', 'approved', 0.5, '2025-12-31'),
  ];
  const snapshot = JSON.stringify(requests);
  const balance = api.calculateLeaveBalance('2023-04-01', policy, requests, 2);
  assert.equal(balance.totalDays, api.calculatePolicyBasedLeaveDays('2023-04-01', 'monthly_accrual', 'join_date') + 2);
  assert.equal(balance.usedDays, 2);
  assert.equal(balance.pendingDays, 1);
  assert.equal(balance.scheduledDays, 0.5);
  assert.equal(balance.remainingDays, balance.totalDays - 2);
  assert.equal(JSON.stringify(requests), snapshot, 'calculation must not mutate records');
  const cancelled = requests.map(r => r.id === '1' ? { ...r, status: 'cancelled' } : r);
  assert.equal(api.calculateLeaveBalance('2023-04-01', policy, cancelled, 2).remainingDays, balance.remainingDays + 1);
  for (const basis of ['join_date', 'fiscal_year']) for (const type of ['none', 'annual_only', 'annual_monthly']) {
    const value = api.calculateLeaveBalance('2023-04-01', { ...policy, grant_basis: basis, auto_expire_enabled: true, auto_expire_type: type }, requests, -1);
    assert.equal(value.remainingDays, value.totalDays - value.usedDays - value.expiration.expiredDays);
  }
  const route = (query, manager = false, admin = false) => api.resolveAttendanceHub(new URLSearchParams(query), manager, admin);
  assert.equal(route('scope=all&tab=members&employee=someone').scope, 'my');
  assert.equal(route('scope=all&tab=members&employee=someone').employee, null);
  assert.equal(route('scope=all&tab=settings', true).tab, 'overview');
  assert.equal(route('scope=all&tab=settings', true, true).tab, 'settings');
  assert.equal(route('scope=all&tab=leave&request=id', true).tab, 'approvals');
  assert.equal(route('scope=all&tab=overtime', true).report, 'overtime');
  assert.equal(route('scope=all&tab=overtime', true).tab, 'reports');
  assert.equal(route('', true, true).scope, 'my');
  assert.equal(route('scope=my&tab=leave', true).tab, 'leave');
  let predicate;
  await api.refreshAttendanceLeave({ invalidateQueries: options => { predicate = options.predicate; } });
  for (const key of ['leave-requests', 'leave-adjustments', 'attendance-calendar', 'attendance-corrections', 'employee-attendance', 'monthly-report-records', 'dept-pattern-leaves', 'leave-dashboard']) {
    assert.ok(predicate({ queryKey: [key] }), key + ' must refresh');
  }
  assert.ok(!predicate({ queryKey: ['saved-quotes'] }));
  const read = path => readFileSync(root + path, 'utf8');
  assert.ok(read('src/hooks/useLeaveRequests.ts').includes("scope: 'my' | 'all' | string = 'my'"));
  assert.ok(!/from\('attendance_correction_requests'\)[\s\S]{0,100}\.(insert|update|delete)\(/.test(read('src/components/mypage/MyAttendanceLeaveSection.tsx')));
  const migration = read('supabase/migrations/20260909160000_attendance_leave_hub.sql');
  assert.ok(read('src/components/leave/LeaveAdjustmentDialog.tsx').includes('id: requestId.current'), 'retry reuses adjustment primary key');
  for (const part of ['attendance_before', 'attendance_after', 'FOR UPDATE', 'IS DISTINCT FROM', 'pg_advisory_xact_lock', 'REVOKE INSERT, UPDATE, DELETE']) assert.ok(migration.includes(part), part);
  assert.ok(!/UPDATE public\.leave_requests|DELETE FROM public\.leave_requests/.test(migration), 'no historical leave rewrite');
  console.log('attendance hub: balance compatibility, routes, refresh boundaries and SQL safety checks passed');
} finally { globalThis.Date = NativeDate; }
