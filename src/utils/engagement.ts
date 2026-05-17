import { supabase } from '@/integrations/supabase/client';

const pad = (value: number) => String(value).padStart(2, '0');

export const toLocalDateKey = (date: Date) => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
);

const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start: start.toISOString(), end: end.toISOString() };
};

export async function getTodayQuoteCount(userId: string) {
  const { start, end } = getTodayRange();
  const { count, error } = await supabase
    .from('saved_quotes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('quote_date', start)
    .lt('quote_date', end);

  if (error) throw error;
  return count || 0;
}

export function getQuoteCelebrationCopy(todayQuoteCount: number) {
  if (todayQuoteCount >= 5) {
    return {
      title: '오늘 견적 페이스 좋습니다.',
      description: `오늘 ${todayQuoteCount}건째 발행했습니다.`,
    };
  }

  return {
    title: '견적서 발행 완료. 오늘도 한 건 처리했습니다.',
    description: todayQuoteCount > 1 ? `오늘 ${todayQuoteCount}건째 발행했습니다.` : undefined,
  };
}

const getMonday = (date: Date) => {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  const day = monday.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diff);
  return monday;
};

export function getWeekdayKeysThroughToday(date = new Date()) {
  const today = new Date(date);
  today.setHours(0, 0, 0, 0);

  const cursor = getMonday(today);
  const keys: string[] = [];

  while (cursor <= today) {
    const day = cursor.getDay();
    if (day >= 1 && day <= 5) {
      keys.push(toLocalDateKey(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

export type AttendanceStreakRecord = {
  date: string;
  check_in: string | null;
  status: string | null;
};

export function calculateCurrentWeekAttendanceStreak(
  records: AttendanceStreakRecord[],
  date = new Date(),
) {
  const presentDates = new Set(
    records
      .filter(record => (
        Boolean(record.check_in) &&
        ['present', 'checked_in', 'checked_out'].includes(record.status || '')
      ))
      .map(record => record.date),
  );

  return getWeekdayKeysThroughToday(date).reduce((streak, key) => (
    presentDates.has(key) ? streak + 1 : 0
  ), 0);
}

export function getAttendanceStreakCopy(streak: number) {
  if (streak >= 5) return `이번 주 ${streak}일 연속 정상 출근`;
  if (streak >= 2) return `이번 주 ${streak}일 연속 출근`;
  return null;
}
