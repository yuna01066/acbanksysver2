import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import QuickAttendanceButton from '@/components/QuickAttendanceButton';
import LeaveSummaryCards from '@/components/leave/LeaveSummaryCards';
import LeaveTypeCards from '@/components/leave/LeaveTypeCards';
import LeaveUsageHistory from '@/components/leave/LeaveUsageHistory';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import {
  calculatePolicyBasedLeaveDays,
  useLeaveRequests,
} from '@/hooks/useLeaveRequests';
import { useLeaveAdjustments } from '@/hooks/useLeaveAdjustments';
import { useLeavePolicy } from '@/hooks/useLeavePolicy';
import { useMyHrProfile } from '@/hooks/useHrSelfService';
import { calculateExpiredLeave } from '@/utils/leaveExpiration';

const leaveBalanceTypes = ['annual', 'monthly', 'half_am', 'half_pm'];

const MyAttendanceLeaveSection: React.FC = () => {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useMyHrProfile();
  const { requests, loading, createRequest, cancelRequest } = useLeaveRequests();
  const { policy, loading: policyLoading, unitLabel, canRequest } = useLeavePolicy();
  const { getNetAdjustment } = useLeaveAdjustments(user?.id);

  const myRequests = useMemo(
    () => requests.filter((request) => request.user_id === user?.id),
    [requests, user?.id],
  );

  const summary = useMemo(() => {
    const joinDate = profile?.join_date || '';
    const base = calculatePolicyBasedLeaveDays(joinDate, policy.grant_method, policy.grant_basis);
    const totalDays = base + (user ? getNetAdjustment(user.id) : 0);
    const usedDays = myRequests
      .filter((request) => request.status === 'approved' && leaveBalanceTypes.includes(request.leave_type))
      .reduce((sum, request) => sum + Number(request.days || 0), 0);
    const usedMonthlyDays = myRequests
      .filter((request) => request.status === 'approved' && ['monthly', 'annual'].includes(request.leave_type))
      .reduce((sum, request) => sum + Number(request.days || 0), 0);
    const pendingDays = myRequests
      .filter((request) => request.status === 'pending' && leaveBalanceTypes.includes(request.leave_type))
      .reduce((sum, request) => sum + Number(request.days || 0), 0);
    const expiration = policy.auto_expire_enabled
      ? calculateExpiredLeave(joinDate, policy.grant_basis, policy.auto_expire_type, usedDays, usedMonthlyDays)
      : { expiredDays: 0, expiringSoonDays: 0, expirationDate: null, details: [] };

    return {
      totalDays,
      usedDays,
      pendingDays,
      remainingDays: totalDays - usedDays - expiration.expiredDays,
      expiration,
    };
  }, [getNetAdjustment, myRequests, policy.auto_expire_enabled, policy.auto_expire_type, policy.grant_basis, policy.grant_method, profile?.join_date, user]);

  if (profileLoading || policyLoading || loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!profile?.join_date && (
        <Alert>
          <AlertTitle>입사일 확인 필요</AlertTitle>
          <AlertDescription>
            입사일이 등록되지 않아 연차가 정확히 계산되지 않을 수 있습니다. 내 인사정보 탭에서 변경 요청을 접수하세요.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[360px,1fr]">
        <QuickAttendanceButton />
        <LeaveSummaryCards
          totalDays={summary.totalDays}
          usedDays={summary.usedDays}
          pendingDays={summary.pendingDays}
          remainingDays={summary.remainingDays}
          unitLabel={unitLabel}
          allowAdvanceUse={policy.allow_advance_use}
          expiredDays={summary.expiration.expiredDays}
          expiringSoonDays={summary.expiration.expiringSoonDays}
          expirationDate={summary.expiration.expirationDate}
        />
      </div>

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">휴가 신청</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaveTypeCards
            onSubmit={createRequest}
            remainingDays={summary.remainingDays}
            leavePolicy={policy}
            canRequest={canRequest}
          />
        </CardContent>
      </Card>

      <Card className="border">
        <CardHeader>
          <CardTitle className="text-base">휴가 사용 기록</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaveUsageHistory
            requests={myRequests}
            currentUserId={user?.id || ''}
            onCancel={cancelRequest}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default MyAttendanceLeaveSection;
