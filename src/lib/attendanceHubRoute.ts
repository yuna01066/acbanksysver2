export type AttendanceScope = 'my' | 'all';
export const personalTabs = ['attendance', 'leave'] as const;
export const adminTabs = ['overview', 'approvals', 'members', 'reports', 'settings'] as const;

export function resolveAttendanceHub(params: URLSearchParams, canManage: boolean, isAdmin: boolean) {
  const scope: AttendanceScope = canManage && params.get('scope') === 'all' ? 'all' : 'my';
  let tab = params.get('tab') || (scope === 'all' ? 'overview' : 'attendance');
  const report = ['overtime', 'monthly-report', 'dept-analysis'].includes(tab) ? tab : params.get('report') || 'monthly-report';
  if (scope === 'all') {
    if (tab === 'attendance') tab = 'overview';
    if (tab === 'leave') tab = params.has('request') ? 'approvals' : 'members';
    if (['overtime', 'monthly-report', 'dept-analysis'].includes(tab)) tab = 'reports';
    if (!(adminTabs as readonly string[]).includes(tab) || (tab === 'settings' && !isAdmin)) tab = 'overview';
  } else if (!(personalTabs as readonly string[]).includes(tab)) tab = 'attendance';
  return { scope, tab, report, employee: scope === 'all' ? params.get('employee') : null, request: params.get('request') || undefined };
}
