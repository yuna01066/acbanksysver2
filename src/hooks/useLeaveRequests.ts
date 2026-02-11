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
  status: string;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  reject_reason: string | null;
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
  const { user, profile, isAdmin, isModerator } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const query = supabase
      .from('leave_requests')
      .select('*')
      .order('created_at', { ascending: false });

    // Non-admin users only see their own (RLS handles this, but be explicit)
    if (!isAdmin && !isModerator) {
      query.eq('user_id', user.id);
    }

    const { data, error } = await query;
    if (!error && data) {
      setRequests(data as LeaveRequest[]);
    }
    setLoading(false);
  }, [user, isAdmin, isModerator]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Helper: send notifications to all admins
  const notifyAdmins = async (title: string, description: string, type: string, data?: Record<string, any>) => {
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'moderator']);
    if (!adminRoles) return;
    const uniqueIds = [...new Set(adminRoles.map(r => r.user_id))];
    for (const adminId of uniqueIds) {
      await supabase.from('notifications').insert({
        user_id: adminId,
        type,
        title,
        description,
        data: data || {},
      });
    }
  };

  // Helper: send notification to a specific user
  const notifyUser = async (userId: string, title: string, description: string, type: string, data?: Record<string, any>) => {
    await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      description,
      data: data || {},
    });
  };

  const createRequest = async (params: {
    leave_type: string;
    start_date: string;
    end_date: string;
    days: number;
    reason?: string;
  }) => {
    if (!user || !profile) return;
    const { error } = await supabase.from('leave_requests').insert({
      user_id: user.id,
      user_name: profile.full_name,
      ...params,
    });
    if (error) {
      toast.error('연차 신청 실패: ' + error.message);
      return false;
    }
    toast.success('연차가 신청되었습니다.');

    // Notify admins
    const leaveLabel = LEAVE_TYPES[params.leave_type] || params.leave_type;
    await notifyAdmins(
      '연차 신청',
      `${profile.full_name}님이 ${leaveLabel} ${params.days}일을 신청했습니다. (${params.start_date} ~ ${params.end_date})`,
      'leave_request',
      { leave_type: params.leave_type, start_date: params.start_date, end_date: params.end_date, days: params.days, user_name: profile.full_name },
    );

    await fetchRequests();
    return true;
  };

  const approveRequest = async (id: string) => {
    if (!user || !profile) return;
    // Find the request to get requester info
    const target = requests.find(r => r.id === id);
    const { error } = await supabase.from('leave_requests').update({
      status: 'approved',
      approved_by: user.id,
      approved_by_name: profile.full_name,
      approved_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) {
      toast.error('승인 실패: ' + error.message);
      return;
    }
    toast.success('승인되었습니다.');

    // Notify the requester
    if (target) {
      const leaveLabel = LEAVE_TYPES[target.leave_type] || target.leave_type;
      await notifyUser(
        target.user_id,
        '연차 승인',
        `${leaveLabel} ${target.days}일 (${target.start_date} ~ ${target.end_date}) 신청이 승인되었습니다.`,
        'leave_approved',
        { leave_request_id: id },
      );
    }

    await fetchRequests();
  };

  const rejectRequest = async (id: string, rejectReason: string) => {
    if (!user || !profile) return;
    const target = requests.find(r => r.id === id);
    const { error } = await supabase.from('leave_requests').update({
      status: 'rejected',
      approved_by: user.id,
      approved_by_name: profile.full_name,
      approved_at: new Date().toISOString(),
      reject_reason: rejectReason,
    }).eq('id', id);
    if (error) {
      toast.error('반려 실패: ' + error.message);
      return;
    }
    toast.success('반려되었습니다.');

    // Notify the requester
    if (target) {
      const leaveLabel = LEAVE_TYPES[target.leave_type] || target.leave_type;
      await notifyUser(
        target.user_id,
        '연차 반려',
        `${leaveLabel} ${target.days}일 (${target.start_date} ~ ${target.end_date}) 신청이 반려되었습니다. 사유: ${rejectReason}`,
        'leave_rejected',
        { leave_request_id: id, reject_reason: rejectReason },
      );
    }

    await fetchRequests();
  };

  const cancelRequest = async (id: string) => {
    const { error } = await supabase.from('leave_requests').delete().eq('id', id);
    if (error) {
      toast.error('취소 실패: ' + error.message);
      return;
    }
    toast.success('취소되었습니다.');
    await fetchRequests();
  };

  return { requests, loading, createRequest, approveRequest, rejectRequest, cancelRequest, refresh: fetchRequests };
};
