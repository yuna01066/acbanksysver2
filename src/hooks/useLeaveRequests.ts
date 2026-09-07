import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { differenceInMonths, differenceInYears, differenceInCalendarDays, eachDayOfInterval, isWeekend } from 'date-fns';

export interface LeaveRequest {
  id: string;
  user_id: string;
  user_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  reject_reason: string | null;
  created_at: string;
}

export interface LeaveCancellationRequest {
  id: string;
  leave_request_id: string;
  requested_by: string;
  requested_by_name: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export const LEAVE_TYPES: Record<string, string> = {
  annual: '연차',
  monthly: '월차',
  half_am: '오전 반차',
  half_pm: '오후 반차',
  sick: '병가',
  special: '특별휴가',
  unpaid: '무급휴가',
  other: '기타',
  family_care: '가족돌봄',
  infertility: '난임 치료',
  marriage_self: '결혼 - 본인',
  marriage_child: '결혼 - 자녀',
  refresh: '리프레시',
  emergency: '비상',
  summer: '여름(바캉스)',
  condolence_close: '조의 - 부모/배우자/자녀',
  condolence_extended: '조의 - 조부모/형제/자매',
};

export const LEAVE_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '승인 대기', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  approved: { label: '승인', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  rejected: { label: '반려', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  cancelled: { label: '취소', color: 'bg-muted text-muted-foreground' },
};

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

export const useLeaveRequests = () => {
  const { user, isAdmin, isModerator } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [cancellations, setCancellations] = useState<LeaveCancellationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!user) {
      setRequests([]);
      setCancellations([]);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const requestQuery = supabase
        .from('leave_requests')
        .select('*')
        .order('created_at', { ascending: false });

      // Non-admin users only see their own (RLS handles this, but be explicit)
      if (!isAdmin && !isModerator) {
        requestQuery.eq('user_id', user.id);
      }

      // Generated database types are refreshed after the migration is applied.
      const cancellationQuery = (supabase.from as any)('leave_cancellation_requests')
        .select('*')
        .order('created_at', { ascending: false });
      const [requestResult, cancellationResult] = await Promise.all([requestQuery, cancellationQuery]);
      if (requestResult.error) throw requestResult.error;
      if (cancellationResult.error) throw cancellationResult.error;
      setRequests(requestResult.data as LeaveRequest[]);
      setCancellations(cancellationResult.data as LeaveCancellationRequest[]);
    } catch (error) {
      console.error('연차 신청 내역 조회 에러:', error);
      setLoadError(error instanceof Error ? error.message : '휴가 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, isModerator]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const callRpc = async (name: string, args: Record<string, unknown>, success: string, failure: string) => {
    const { error } = await (supabase.rpc as any)(name, args);
    if (error) {
      toast.error(`${failure}: ${error.message}`);
      await fetchRequests();
      return false;
    }
    toast.success(success);
    await fetchRequests();
    return true;
  };

  const createRequest = async (params: {
    leave_type: string;
    start_date: string;
    end_date: string;
    days: number;
    reason?: string;
  }) => {
    if (!user) return false;
    return callRpc('submit_leave_request', {
      _leave_type: params.leave_type,
      _start_date: params.start_date,
      _end_date: params.end_date,
      _reason: params.reason || null,
    }, '휴가가 신청되었습니다.', '휴가 신청 실패');
  };

  const approveRequest = (id: string) => callRpc(
    'review_leave_request', { _request_id: id, _decision: 'approved', _reason: null },
    '승인되었습니다.', '승인 실패',
  );

  const rejectRequest = (id: string, rejectReason: string) => callRpc(
    'review_leave_request', { _request_id: id, _decision: 'rejected', _reason: rejectReason },
    '반려되었습니다.', '반려 실패',
  );

  const cancelRequest = (id: string) => callRpc(
    'cancel_pending_leave_request', { _request_id: id },
    '신청을 취소했습니다.', '취소 실패',
  );

  const requestCancellation = (id: string, reason: string) => callRpc(
    'request_leave_cancellation', { _leave_request_id: id, _reason: reason },
    '취소 승인 요청을 보냈습니다.', '취소 요청 실패',
  );

  const reviewCancellation = (id: string, decision: 'approved' | 'rejected', note?: string) => callRpc(
    'review_leave_cancellation', { _cancellation_id: id, _decision: decision, _review_note: note || null },
    decision === 'approved' ? '휴가 취소를 승인했습니다.' : '휴가 취소 요청을 반려했습니다.',
    '취소 요청 처리 실패',
  );

  const adminCancelRequest = (id: string, reason: string) => callRpc(
    'admin_cancel_leave', { _leave_request_id: id, _reason: reason },
    '휴가를 취소했습니다.', '관리자 취소 실패',
  );

  const adminCreateRequest = (params: {
    user_id: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    reason?: string;
  }) => callRpc('admin_create_leave_request', {
    _user_id: params.user_id,
    _leave_type: params.leave_type,
    _start_date: params.start_date,
    _end_date: params.end_date,
    _reason: params.reason || null,
  }, '휴가를 등록했습니다.', '휴가 등록 실패');

  return {
    requests,
    cancellations,
    loading,
    loadError,
    createRequest,
    approveRequest,
    rejectRequest,
    cancelRequest,
    requestCancellation,
    reviewCancellation,
    adminCancelRequest,
    adminCreateRequest,
    refresh: fetchRequests,
  };
};
