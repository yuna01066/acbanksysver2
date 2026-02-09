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
  half_am: '오전 반차',
  half_pm: '오후 반차',
  sick: '병가',
  special: '특별휴가',
  unpaid: '무급휴가',
};

export const LEAVE_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '승인 대기', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  approved: { label: '승인', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  rejected: { label: '반려', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  cancelled: { label: '취소', color: 'bg-muted text-muted-foreground' },
};

// 근로기준법 제60조 기반 연차 계산
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
