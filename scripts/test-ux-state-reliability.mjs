import assert from 'node:assert/strict';
import fs from 'node:fs';

const projectRoot = new URL('../', import.meta.url);
const read = (relativePath) => fs.readFileSync(new URL(relativePath, projectRoot), 'utf8');

const businessDashboard = read('src/components/dashboard/BusinessDashboard.tsx');
const quoteStatistics = read('src/components/dashboard/QuoteStatisticsCard.tsx');
const calendarHook = read('src/hooks/useInternalCalendar.ts');
const calendarPanel = read('src/components/dashboard/DashboardCalendarPanel.tsx');
const calendarPage = read('src/pages/CalendarPage.tsx');
const quickNav = read('src/components/GlobalQuickNav.tsx');
const navigationAccess = read('src/hooks/useNavigationPageAccess.ts');
const pageAccessPolicy = read('src/lib/pageAccessPolicy.ts');
const dashboardQuickLinks = read('src/components/dashboard/DashboardQuickLinksSection.tsx');
const home = read('src/pages/Home.tsx');
const leaveHook = read('src/hooks/useLeaveRequests.ts');
const leavePage = read('src/pages/LeaveManagementPage.tsx');

assert.ok(
  (businessDashboard.match(/if \(error\) throw error/g) || []).length >= 3,
  'Every business dashboard query must throw Supabase errors',
);
assert.match(businessDashboard, /경영 데이터를 불러오지 못했습니다/);
assert.match(businessDashboard, /refetch/);
assert.match(quoteStatistics, /견적 통계를 불러오지 못했습니다/);
assert.match(quoteStatistics, /refetch/);
assert.match(
  quoteStatistics,
  /select\('id, quote_date, total, project_stage, quote_status, recipient_company, lost_recorded_at, lost_reason_category'\)/,
  'Quote loss statistics must fetch the fields used by the calculation',
);

assert.match(calendarHook, /sourceWarnings/);
assert.match(calendarHook, /생일 일정/);
assert.match(calendarHook, /Notion 일정/);
assert.doesNotMatch(calendarHook, /if \(error\) return \[\];/);
assert.match(calendarPanel, /일부 일정 연동 실패/);
assert.match(calendarPanel, /일정을 불러오지 못했습니다/);
assert.match(calendarPanel, /refetch/);
assert.match(calendarPage, /error: eventsError/);
assert.match(calendarPage, /sourceWarnings/);
assert.match(calendarPage, /캘린더를 불러오지 못했습니다/);
assert.match(calendarPage, /일부 일정 연동에 실패했습니다/);
assert.match(calendarPage, /refetchEvents/);

assert.match(quickNav, /useNavigationPageAccess/);
assert.match(quickNav, /passesMasterProtectedPageGate/);
assert.match(quickNav, /if \(!passesMasterProtectedPageGate\(item\.path, isMaster\)\) return false/);
assert.match(dashboardQuickLinks, /useNavigationPageAccess/);
assert.match(dashboardQuickLinks, /passesMasterProtectedPageGate/);
assert.match(dashboardQuickLinks, /canAccessPath\(item\.path\)/);
assert.match(navigationAccess, /from\('page_role_access'\)/);
assert.match(navigationAccess, /from\('page_access_permissions'\)/);
assert.match(navigationAccess, /isPageAllowedByPolicy/);
assert.match(pageAccessPolicy, /matchedOverride\?\.effect === 'deny'/);
assert.match(pageAccessPolicy, /matchedOverride\?\.effect === 'allow'/);
assert.match(pageAccessPolicy, /MASTER_PROTECTED_PAGE_PATHS/);
assert.doesNotMatch(home, /userRole=\{userRole\}/);
assert.match(home, /id: "tax-invoices"[\s\S]*?requiresMaster: true/);
assert.match(leaveHook, /\.update\(\{ status: 'cancelled' \}\)/);
assert.doesNotMatch(leaveHook, /from\('leave_requests'\)\.delete\(\)/);
assert.ok(
  (leaveHook.match(/\.eq\('status', 'pending'\)/g) || []).length >= 3,
  'approve, reject, and cancel transitions must compare the pending state',
);
assert.ok(
  (leaveHook.match(/\.select\('id'\)\s+\.maybeSingle\(\)/g) || []).length >= 3,
  'leave transitions must confirm that exactly one pending row changed',
);
assert.match(leaveHook, /loadError/);
assert.match(leavePage, /휴가 데이터를 불러오지 못했습니다/);

console.log('UX state reliability regression checks passed.');
