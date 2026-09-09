import { readAllRows } from '@/lib/readAllRows';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { refreshAttendanceLeave } from '@/lib/attendanceLeaveQueries';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
export { calculateAnnualLeaveDays, calculatePolicyBasedLeaveDays, calculateMonthlyLeaveDays, calculateAnnualOnlyDays, calculateBusinessDays } from '@/lib/leaveBalance';

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

export const useLeaveRequests = (scope: 'my' | 'all' | string = 'my') => {
  const { user, isAdmin, isModerator, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const target = (isAdmin || isModerator) && scope !== 'my' ? scope : user?.id;
  const query = useQuery({
    queryKey: ['leave-requests', user?.id, target],
    enabled: !!user && !authLoading,
    queryFn: async () => {
      const requestQuery = supabase.from('leave_requests').select('*').order('created_at', { ascending: false }).order('id');
      const cancellationQuery = supabase.from('leave_cancellation_requests').select('*, leave_requests!inner(user_id)').order('created_at', { ascending: false }).order('id');
      if (target !== 'all') {
        requestQuery.eq('user_id', target!);
        cancellationQuery.eq('leave_requests.user_id', target!);
      }
      const [requests, cancellations] = await Promise.all([readAllRows(requestQuery), readAllRows(cancellationQuery)]);
      return { requests: requests as LeaveRequest[], cancellations: cancellations as LeaveCancellationRequest[] };
    },
  });
  const requests = query.data?.requests || [];
  const cancellations = query.data?.cancellations || [];
  const loading = authLoading || query.isLoading;
  const loadError = query.error?.message || null;
  const fetchRequests = () => refreshAttendanceLeave(queryClient);

  const callRpc = async (name: string, args: Record<string, unknown>, success: string, failure: string) => {
    try {
      const { error } = await (supabase.rpc as any)(name, args);
      if (error) throw error;
      await fetchRequests();
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(`${failure}: ${error instanceof Error ? error.message : (error as { message?: string })?.message || '다시 시도해주세요.'}`);
      await fetchRequests();
      return false;
    }
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
