import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useLeaveAdjustments } from '@/hooks/useLeaveAdjustments';
import { useLeavePolicy } from '@/hooks/useLeavePolicy';
import { calculateLeaveBalance } from '@/lib/leaveBalance';
import { Button } from '@/components/ui/button';
import LeaveSummaryCards from '@/components/leave/LeaveSummaryCards';
import LeaveDetailTable from '@/components/leave/LeaveDetailTable';
import LeaveTypeCards from '@/components/leave/LeaveTypeCards';
import LeaveUsageHistory from '@/components/leave/LeaveUsageHistory';

// Personal content only. Administrative operations live in the attendance hub.
export default function LeaveManagementPage({ focusedRequestId }: { embedded?: boolean; defaultTab?: string; focusedRequestId?: string }) {
  const { user } = useAuth();
  const leave = useLeaveRequests('my');
  const { policy, loading, error, canRequest, refresh } = useLeavePolicy();
  const adjustment = useLeaveAdjustments(user?.id);
  const profile = useQuery({
    queryKey: ['leave-profile', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('join_date').eq('id', user!.id).single();
      if (error) throw error;
      return data;
    },
  });
  const retry = () => { void leave.refresh(); void refresh(); void profile.refetch(); void adjustment.refresh(); };
  if (leave.loadError || error || profile.error || adjustment.error) return (
    <div role="alert" className="rounded-lg border border-destructive/30 p-4">
      <p>연차 정보를 불러오지 못했습니다. 잔여량과 신청 기능은 확인 후 표시됩니다.</p>
      <Button variant="outline" onClick={retry} className="mt-3">다시 시도</Button>
    </div>
  );
  if (loading || leave.loading || profile.isLoading || adjustment.loading) return <p role="status" className="p-6 text-muted-foreground">연차·휴가 정보를 불러오는 중…</p>;
  const joinDate = profile.data?.join_date || '';
  const balance = calculateLeaveBalance(joinDate, policy, leave.requests, adjustment.getNetAdjustment(user!.id));
  return (
    <div className="space-y-6">
      <section aria-label="현재 연차 잔액" className="space-y-3">
        <h2 className="text-lg font-semibold">현재 연차</h2>
        <LeaveSummaryCards {...balance} expiredDays={balance.expiration.expiredDays}
          expiringSoonDays={balance.expiration.expiringSoonDays} expirationDate={balance.expiration.expirationDate}
          allowAdvanceUse={policy.allow_advance_use} />
        <p className="text-sm text-muted-foreground">사용 반영에는 승인된 예정 휴가 {balance.scheduledDays}일이 포함됩니다. 아래 기록의 연도 선택과 현재 잔액은 별개입니다.</p>
        {!joinDate && <p role="status" className="text-sm text-muted-foreground">입사일이 등록되지 않았습니다. 관리자에게 등록을 요청해 주세요.</p>}
      </section>
      <LeaveTypeCards onSubmit={leave.createRequest} remainingDays={balance.remainingDays} leavePolicy={policy} canRequest={canRequest} />
      <LeaveUsageHistory focusedRequestId={focusedRequestId} requests={leave.requests} cancellations={leave.cancellations}
        currentUserId={user?.id || ''} onCancel={leave.cancelRequest} onRequestCancellation={leave.requestCancellation} />
      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-medium focus-visible:outline focus-visible:outline-2">연차 산정 상세</summary>
        <LeaveDetailTable joinDate={joinDate} requests={leave.requests} grantMethod={policy.grant_method} grantBasis={policy.grant_basis} />
      </details>
    </div>
  );
}
