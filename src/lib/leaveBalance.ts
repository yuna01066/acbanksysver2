import { differenceInMonths, differenceInYears, differenceInCalendarDays, eachDayOfInterval, isWeekend, format } from 'date-fns';
import { calculateExpiredLeave } from '@/utils/leaveExpiration';
import type { LeaveRequest } from '@/hooks/useLeaveRequests';
import type { LeavePolicy } from '@/hooks/useLeavePolicy';

// 근로기준법 제60조 기반 연차 계산 (기본)
export const calculateAnnualLeaveDays = (joinDate: string): number => {
  if (!joinDate) return 0;
  const jd = new Date(joinDate);
  const now = new Date();
  const totalMonths = differenceInMonths(now, jd);
  const totalYears = differenceInYears(now, jd);

  if (totalMonths < 12) return Math.min(totalMonths, 11);

  let days = 15;
  if (totalYears >= 3) {
    days += Math.min(Math.floor((totalYears - 1) / 2), 10);
  }
  return Math.min(days, 25);
};

/**
 * 정책 기반 연차 계산
 * @param joinDate 입사일
 * @param grantMethod 부여 방식: monthly_accrual | annual_grant | proportional
 * @param grantBasis 부여 기준일: join_date | fiscal_year
 */
export const calculatePolicyBasedLeaveDays = (
  joinDate: string,
  grantMethod: string,
  grantBasis: string,
): number => {
  if (!joinDate) return 0;
  const jd = new Date(joinDate);
  const now = new Date();
  const totalMonths = differenceInMonths(now, jd);
  const totalYears = differenceInYears(now, jd);

  // 근로기준법 기준 연차 (1년 이상 근무자)
  const legalAnnualDays = (() => {
    let days = 15;
    if (totalYears >= 3) {
      days += Math.min(Math.floor((totalYears - 1) / 2), 10);
    }
    return Math.min(days, 25);
  })();

  switch (grantMethod) {
    case 'monthly_accrual': {
      // 매월 개근 시 1일 부여 (1년 미만), 1년 이상 시 법정 연차
      if (totalMonths < 12) {
        return Math.min(totalMonths, 11);
      }
      return legalAnnualDays;
    }

    case 'annual_grant': {
      // 연 단위 일괄 부여
      if (totalMonths < 12) {
        // 1년 미만: 아직 연차 미발생 (월차만 적용)
        return Math.min(totalMonths, 11);
      }
      if (grantBasis === 'fiscal_year') {
        // 회계연도 기준: 1월 1일에 일괄 부여
        return legalAnnualDays;
      }
      // 입사일 기준: 입사 기념일에 일괄 부여
      return legalAnnualDays;
    }

    case 'proportional': {
      // 비례 부여: 회계연도 기준 잔여 기간에 비례하여 부여
      if (totalMonths < 12) {
        return Math.min(totalMonths, 11);
      }
      if (grantBasis === 'fiscal_year') {
        // 회계연도(1/1~12/31) 기준 비례 계산
        const currentYear = now.getFullYear();
        const yearStart = new Date(currentYear, 0, 1);
        const yearEnd = new Date(currentYear, 11, 31);
        const totalDaysInYear = differenceInCalendarDays(yearEnd, yearStart) + 1;
        const daysWorked = differenceInCalendarDays(now, yearStart) + 1;
        const ratio = Math.min(daysWorked / totalDaysInYear, 1);
        return Math.round(legalAnnualDays * ratio * 10) / 10;
      }
      // 입사일 기준 비례 (입사 기념일 주기)
      const anniversaryStart = new Date(jd);
      anniversaryStart.setFullYear(jd.getFullYear() + totalYears);
      const anniversaryEnd = new Date(anniversaryStart);
      anniversaryEnd.setFullYear(anniversaryStart.getFullYear() + 1);
      const periodDays = differenceInCalendarDays(anniversaryEnd, anniversaryStart);
      const elapsed = differenceInCalendarDays(now, anniversaryStart);
      const ratio = Math.min(elapsed / periodDays, 1);
      return Math.round(legalAnnualDays * ratio * 10) / 10;
    }

    default:
      return calculateAnnualLeaveDays(joinDate);
  }
};

/**
 * 월차 계산: 1년 미만 근무자에게 매월 1일씩 부여 (최대 11일)
 */
export const calculateMonthlyLeaveDays = (joinDate: string): number => {
  if (!joinDate) return 0;
  const jd = new Date(joinDate);
  const now = new Date();
  const totalMonths = differenceInMonths(now, jd);
  if (totalMonths >= 12) return 0; // 1년 이상 근무자는 월차 없음 (연차로 전환)
  return Math.min(totalMonths, 11);
};

/**
 * 연차 계산 (월차 제외, 1년 이상 근무자만)
 */
export const calculateAnnualOnlyDays = (joinDate: string): number => {
  if (!joinDate) return 0;
  const jd = new Date(joinDate);
  const now = new Date();
  const totalMonths = differenceInMonths(now, jd);
  const totalYears = differenceInYears(now, jd);
  if (totalMonths < 12) return 0; // 1년 미만은 월차만
  let days = 15;
  if (totalYears >= 3) {
    days += Math.min(Math.floor((totalYears - 1) / 2), 10);
  }
  return Math.min(days, 25);
};

export const calculateBusinessDays = (start: string, end: string): number => {
  const days = eachDayOfInterval({ start: new Date(start), end: new Date(end) });
  return days.filter(d => !isWeekend(d)).length;
};


export const BALANCE_LEAVE_TYPES = new Set(['annual', 'monthly', 'half_am', 'half_pm']);

// Preserve the existing personal leave calculation; history filters never feed this balance.
export function calculateLeaveBalance(joinDate: string, policy: LeavePolicy, requests: LeaveRequest[], netAdjustment = 0) {
  const annual = requests.filter(r => BALANCE_LEAVE_TYPES.has(r.leave_type));
  const approved = annual.filter(r => r.status === 'approved');
  const usedDays = approved.reduce((sum, r) => sum + Number(r.days), 0);
  const usedMonthlyDays = approved.filter(r => ['monthly', 'annual'].includes(r.leave_type))
    .reduce((sum, r) => sum + Number(r.days), 0);
  const pendingDays = annual.filter(r => r.status === 'pending').reduce((sum, r) => sum + Number(r.days), 0);
  const totalDays = calculatePolicyBasedLeaveDays(joinDate, policy.grant_method, policy.grant_basis) + netAdjustment;
  const expiration = policy.auto_expire_enabled
    ? calculateExpiredLeave(joinDate, policy.grant_basis, policy.auto_expire_type, usedDays, usedMonthlyDays)
    : { expiredDays: 0, expiringSoonDays: 0, expirationDate: null, details: [] };
  const today = format(new Date(), 'yyyy-MM-dd');
  const scheduledDays = approved.filter(r => r.start_date > today).reduce((sum, r) => sum + Number(r.days), 0);
  return { totalDays, usedDays, pendingDays, scheduledDays, expiration, remainingDays: totalDays - usedDays - expiration.expiredDays };
}
