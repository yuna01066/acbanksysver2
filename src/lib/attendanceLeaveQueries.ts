import type { QueryClient } from '@tanstack/react-query';

const relatedKeys = new Set([
  'leave-requests', 'leave-adjustments', 'leave-policy', 'attendance-corrections',
  'attendance-today', 'attendance-monthly', 'employee-attendance',
  'mypage-attendance-today', 'mypage-attendance-monthly', 'mypage-attendance-corrections',
  'employee-online-status',
]);

export const refreshAttendanceLeave = (client: QueryClient) => client.invalidateQueries({
  predicate: query => relatedKeys.has(String(query.queryKey[0])) || /attendance|overtime|work-pattern|monthly-report|dept-pattern|leave-dashboard/.test(String(query.queryKey[0])),
});
