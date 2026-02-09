import { differenceInMonths, differenceInYears, differenceInCalendarDays } from 'date-fns';

/**
 * 근로기준법 기반 연차 자동 소멸 계산
 * 
 * 소멸 규칙 (근로기준법 제60조):
 * - 월차(1년 미만 근무자): 발생일로부터 1년 이내 미사용 시 소멸
 * - 연차(1년 이상 근무자): 발생일로부터 1년 이내 미사용 시 소멸
 * 
 * auto_expire_type:
 *   - 'annual_monthly': 연차 + 월차 모두 소멸 적용
 *   - 'annual_only': 연차만 소멸 적용 (월차는 소멸 안 됨)
 *   - 'none': 소멸 없음
 */

export interface ExpirationResult {
  /** 이미 소멸된 연차 일수 */
  expiredDays: number;
  /** 소멸 예정 연차 일수 (현재 기간 남은 기간 기준) */
  expiringSoonDays: number;
  /** 소멸 예정 날짜 */
  expirationDate: Date | null;
  /** 소멸 상세 내역 */
  details: ExpirationDetail[];
}

export interface ExpirationDetail {
  /** 기간 라벨 */
  periodLabel: string;
  /** 발생 연차 */
  grantedDays: number;
  /** 소멸 날짜 */
  expiresAt: Date;
  /** 소멸 여부 */
  isExpired: boolean;
}

/**
 * 자동 소멸 연차 계산
 */
export const calculateExpiredLeave = (
  joinDate: string,
  grantBasis: string,
  autoExpireType: string,
  usedAnnualDays: number,
  usedMonthlyDays: number,
): ExpirationResult => {
  if (!joinDate || autoExpireType === 'none') {
    return { expiredDays: 0, expiringSoonDays: 0, expirationDate: null, details: [] };
  }

  const jd = new Date(joinDate);
  const now = new Date();
  const totalMonths = differenceInMonths(now, jd);
  const totalYears = differenceInYears(now, jd);
  const details: ExpirationDetail[] = [];
  let totalExpired = 0;

  // --- 월차 소멸 계산 (1년 미만 근무 시 발생한 월차) ---
  if (autoExpireType === 'annual_monthly' && totalMonths >= 12) {
    // 1년 미만 근무 기간에 발생한 월차 (최대 11일)
    // 각 월차는 발생일로부터 1년 후 소멸
    const monthlyGranted = Math.min(11, 11); // 1년 근무 완료 시 최대 11일 발생했었음
    // 입사 후 1년이 지났으므로 모든 월차의 소멸 시한(발생월+1년)이 지남
    // 사용한 월차를 차감
    const monthlyExpired = Math.max(0, monthlyGranted - usedMonthlyDays);
    if (monthlyExpired > 0) {
      const expiresAt = new Date(jd);
      expiresAt.setFullYear(jd.getFullYear() + 2); // 마지막 월차(11개월차)의 소멸: 입사+2년
      details.push({
        periodLabel: '월차 (입사 1년 미만)',
        grantedDays: monthlyGranted,
        expiresAt,
        isExpired: now >= expiresAt,
      });
      if (now >= expiresAt) {
        totalExpired += monthlyExpired;
      }
    }
  }

  // --- 연차 소멸 계산 (1년 이상 근무자) ---
  if (totalYears >= 1) {
    // 각 근속 연차별로 소멸 계산
    for (let year = 1; year <= totalYears; year++) {
      // 해당 연도의 법정 연차
      let days = 15;
      if (year >= 3) {
        days += Math.min(Math.floor((year - 1) / 2), 10);
      }
      days = Math.min(days, 25);

      // 소멸 기한 계산
      let expiresAt: Date;
      if (grantBasis === 'fiscal_year') {
        // 회계연도 기준: 해당 연도 12/31까지
        const grantYear = jd.getFullYear() + year;
        expiresAt = new Date(grantYear, 11, 31);
      } else {
        // 입사일 기준: 입사 기념일 + 1년
        expiresAt = new Date(jd);
        expiresAt.setFullYear(jd.getFullYear() + year + 1);
      }

      const isExpired = now >= expiresAt;
      // 현재 연도가 아닌 과거 기간만 소멸 처리
      if (year < totalYears && isExpired) {
        details.push({
          periodLabel: `${year}년차 연차`,
          grantedDays: days,
          expiresAt,
          isExpired: true,
        });
        // 과거 기간의 미사용분 소멸 (단순화: 사용량은 최신 기간부터 차감한다고 가정)
        totalExpired += days;
      } else if (year === totalYears) {
        // 현재 기간 — 소멸 예정
        details.push({
          periodLabel: `${year}년차 연차 (현재)`,
          grantedDays: days,
          expiresAt,
          isExpired: false,
        });
      }
    }

    // 과거 기간 총 발생에서 사용량 차감 (사용량은 과거 기간 소멸분에서 먼저 차감)
    totalExpired = Math.max(0, totalExpired - usedAnnualDays);
  }

  // 소멸 예정일 (현재 기간)
  const currentDetail = details.find(d => !d.isExpired);
  const expirationDate = currentDetail?.expiresAt || null;

  // 소멸 예정 일수 (현재 기간의 남은 연차 중 소멸 예정)
  const currentGranted = currentDetail?.grantedDays || 0;
  const expiringSoonDays = expirationDate ? Math.max(0, currentGranted - usedAnnualDays) : 0;

  return {
    expiredDays: totalExpired,
    expiringSoonDays: autoExpireType !== 'none' ? expiringSoonDays : 0,
    expirationDate,
    details,
  };
};

/**
 * 소멸 예정일까지 남은 일수 계산
 */
export const daysUntilExpiration = (expirationDate: Date | null): number | null => {
  if (!expirationDate) return null;
  const now = new Date();
  const diff = differenceInCalendarDays(expirationDate, now);
  return Math.max(0, diff);
};
