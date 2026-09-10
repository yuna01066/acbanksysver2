import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const bundle = await build({ entryPoints: [root + 'src/components/attendance/monthlyAttendancePrint.tsx'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external' });
const module = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const { buildMonthlyAttendancePrintHtml: render, printMonthlyAttendanceReport: print } = module.exports;
const input = {
  year: 2026, month: 9, generatedAt: new Date('2026-09-10T03:00:00Z'),
  employees: [{ id: 'fixture-1', name: '가상 직원 가', department: '제작', workDays: 2, totalHours: 17, lateDays: 1 },
    { id: 'fixture-empty', name: '가상 직원 나', department: '운영', workDays: 0, totalHours: 0, lateDays: 0 }],
  records: [
    { user_id: 'fixture-1', date: '2026-09-01', check_in: '2026-09-01T00:00:00Z', check_out: '2026-09-01T09:00:00Z', work_hours: 9, status: 'checked_out', memo: '비공개 메모' },
    { user_id: 'fixture-1', date: '2026-09-02', check_in: '2026-09-02T00:15:00Z', check_out: null, work_hours: null, status: 'late' },
    { user_id: 'fixture-1', date: '2026-09-03', check_in: '2026-09-03T14:00:00Z', check_out: '2026-09-03T22:00:00Z', work_hours: 8, status: 'checked_out' },
    { user_id: 'fixture-1', date: '2026-09-09', check_in: null, check_out: null, work_hours: null, status: 'absent' },
    { user_id: 'fixture-1', date: '2026-08-31', check_in: '2026-08-31T00:00:00Z', check_out: null, work_hours: null, status: '다른 달 제외' },
    { user_id: 'other-user', date: '2026-09-01', check_in: null, check_out: null, work_hours: null, status: '다른 직원 제외' },
  ],
  leaveRequests: [
    { user_id: 'fixture-1', start_date: '2026-08-31', end_date: '2026-09-01', leave_type: 'half_am', status: 'approved' },
    { user_id: 'fixture-1', start_date: '2026-09-02', end_date: '2026-09-02', leave_type: 'half_pm', status: 'cancelled' },
    { user_id: 'fixture-1', start_date: '2026-09-03', end_date: '2026-09-03', leave_type: 'half_pm', status: 'pending' },
    { user_id: 'fixture-1', start_date: '2026-09-04', end_date: '2026-09-04', leave_type: 'half_pm', status: 'rejected' },
    { user_id: 'fixture-1', start_date: '2026-09-07', end_date: '2026-09-08', leave_type: 'sick', status: 'approved', reason: '비공개 휴가 사유' },
  ],
  businessDateSet: new Set(Array.from({ length: 30 }, (_, index) => `2026-09-${String(index + 1).padStart(2, '0')}`).filter(date => ![0, 6].includes(new Date(date + 'T12:00:00').getDay()) && date !== '2026-09-07')),
};
const before = JSON.stringify(input);
const html = render(input);
assert.ok(!html.includes('&quot;Apple'), 'trusted stylesheet must retain valid quoted font names');
assert.ok(!html.includes('결근 · 출근 누락'), 'explicit absence is not an incomplete clock record');
for (const text of ['09:00', '18:00', '09/04 07:00', '지각 · 미퇴근', '오전 반차', '승인 휴가', '기록 없음', '회사 휴일', '예정', '주말', '한국시간', '가상 직원 나']) assert.ok(html.includes(text), text);
for (const text of ['오후 반차', '비공개', '다른 달 제외', '다른 직원 제외', 'fixture-1', 'sick']) assert.ok(!html.includes(text), 'must omit ' + text);
assert.equal((html.match(/class="employee"/g) || []).length, 2);
assert.equal((html.match(/scope="row">09\/30/g) || []).length, 2);
assert.ok(!render({ ...input, employees: [input.employees[0]] }).includes('가상 직원 나'));
assert.equal(JSON.stringify(input), before, 'export must not mutate source records');
assert.throws(() => render({ ...input, month: 13 }), /연월/);
assert.throws(() => render({ ...input, employees: [] }), /구성원/);
const unsafe = render({ ...input, employees: [{ ...input.employees[0], name: '<script>alert(1)</script>', department: '<img src=x onerror=alert(1)>' }] });
assert.ok(!unsafe.includes('<script>') && !unsafe.includes('<img'));
assert.ok(unsafe.includes('&lt;script&gt;'));
for (const [year, month, count] of [[2024, 2, 29], [2025, 2, 28], [2026, 1, 31], [2026, 12, 31]]) {
  const document = render({ ...input, year, month, employees: [input.employees[0]], records: [], leaveRequests: [] });
  assert.equal((document.match(/<tr>/g) || []).length, count + 3, 'calendar includes every day');
}
globalThis.window = { open: () => null };
await assert.rejects(print(input), /팝업이 차단/);
let printCount = 0;
let printButton;
const popup = { opener: {}, closed: false, focus() {}, print() { printCount++; }, document: {
  open() {}, write(value) { assert.equal(value, html); }, close() {}, fonts: { ready: Promise.resolve() },
  getElementById() { return { addEventListener(_event, handler) { printButton = handler; } }; },
} };
window.open = () => popup;
await print(input);
assert.equal(popup.opener, null);
assert.equal(printCount, 1);
printButton();
assert.equal(printCount, 2, 'cancelled print can be retried from the document');
popup.closed = true;
printButton();
assert.equal(printCount, 2);
delete globalThis.window;
const source = readFileSync(root + 'src/components/attendance/MonthlyAttendanceReport.tsx', 'utf8');
assert.equal((source.match(/enabled: canManage/g) || []).length, 4);
assert.equal((source.match(/queryFn: \(\) => readAllRows/g) || []).length, 4);
assert.match(source, /isLoading \|\| employeesLoading \|\| leavesLoading \|\| holidaysLoading/);
assert.match(source, /printing \|\| refreshing \|\| !printEmployees.length/);
assert.doesNotMatch(source, /\.(insert|update|delete|rpc)\(/);
if (process.argv.includes('--sample')) {
  mkdirSync(root + 'output/playwright', { recursive: true });
  writeFileSync(root + 'output/playwright/monthly-attendance-sample.html', html);
  const nextMonth = value => value?.replace('2026-09', '2026-10');
  writeFileSync(root + 'output/playwright/monthly-attendance-31-days.html', render({
    ...input, month: 10, generatedAt: new Date('2026-10-10T03:00:00Z'),
    records: input.records.map(row => ({ ...row, date: nextMonth(row.date), check_in: nextMonth(row.check_in), check_out: nextMonth(row.check_out) })),
    leaveRequests: input.leaveRequests.map(row => ({ ...row, start_date: nextMonth(row.start_date), end_date: nextMonth(row.end_date) })),
    businessDateSet: new Set(Array.from({ length: 31 }, (_, index) => `2026-10-${String(index + 1).padStart(2, '0')}`).filter(date => ![0, 6].includes(new Date(date + 'T12:00:00').getDay()) && date !== '2026-10-07')),
  }));
}
console.log('monthly attendance print: date boundaries, time zone, privacy, selection, popup handling and query guards passed');
