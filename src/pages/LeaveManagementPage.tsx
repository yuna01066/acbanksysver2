import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, CalendarDays, Clock, Loader2, Settings2 } from 'lucide-react';
import { useLeaveRequests, calculateAnnualLeaveDays } from '@/hooks/useLeaveRequests';
import { useLeavePolicy } from '@/hooks/useLeavePolicy';
import LeaveRequestForm from '@/components/leave/LeaveRequestForm';
import LeaveRequestList from '@/components/leave/LeaveRequestList';
import LeaveSummaryCards from '@/components/leave/LeaveSummaryCards';
import LeavePolicySettings from '@/components/leave/LeavePolicySettings';

const LeaveManagementPage = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, isModerator, loading: authLoading } = useAuth();
  const { requests, loading, createRequest, approveRequest, rejectRequest, cancelRequest } = useLeaveRequests();
  const { policy, loading: policyLoading, unitLabel, canRequest } = useLeavePolicy();
  const [joinDate, setJoinDate] = useState<string>('');

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('join_date').eq('id', user.id).single()
      .then(({ data }) => {
        if (data?.join_date) setJoinDate(data.join_date);
      });
  }, [user]);

  const totalAnnualDays = useMemo(() => calculateAnnualLeaveDays(joinDate), [joinDate]);

  const myRequests = useMemo(() => requests.filter(r => r.user_id === user?.id), [requests, user]);
  const pendingRequests = useMemo(() => requests.filter(r => r.status === 'pending'), [requests]);

  const usedDays = useMemo(() =>
    myRequests.filter(r => r.status === 'approved' && (r.leave_type === 'annual' || r.leave_type === 'half_am' || r.leave_type === 'half_pm'))
      .reduce((sum, r) => sum + r.days, 0),
    [myRequests]
  );
  const pendingDays = useMemo(() =>
    myRequests.filter(r => r.status === 'pending' && (r.leave_type === 'annual' || r.leave_type === 'half_am' || r.leave_type === 'half_pm'))
      .reduce((sum, r) => sum + r.days, 0),
    [myRequests]
  );
  const remainingDays = totalAnnualDays - usedDays;

  if (authLoading || policyLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b px-4 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-base font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            연차 관리
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/attendance')} className="gap-1">
            <Clock className="h-4 w-4" />
            근태 관리
          </Button>
          <LeaveRequestForm
            onSubmit={createRequest}
            remainingDays={remainingDays}
            leavePolicy={policy}
            canRequest={canRequest}
          />
        </div>
      </div>

      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        <LeaveSummaryCards
          totalDays={totalAnnualDays}
          usedDays={usedDays}
          pendingDays={pendingDays}
          remainingDays={remainingDays}
          unitLabel={unitLabel}
          allowAdvanceUse={policy.allow_advance_use}
        />

        {!joinDate && (
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 p-3 text-sm text-yellow-800 dark:text-yellow-300">
            ⚠️ 입사일이 등록되지 않아 연차가 0일로 계산됩니다. 마이페이지 또는 관리자에게 입사일 등록을 요청하세요.
          </div>
        )}

        {policy.allow_advance_use && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-3 text-sm text-blue-800 dark:text-blue-300">
            ℹ️ 당겨쓰기가 허용되어 잔여 연차를 초과하여 신청할 수 있습니다.
          </div>
        )}

        <Tabs defaultValue="my">
          <TabsList className="bg-muted">
            <TabsTrigger value="my">내 신청 내역</TabsTrigger>
            {(isAdmin || isModerator) && (
              <TabsTrigger value="all" className="relative">
                전체 관리
                {pendingRequests.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs bg-destructive text-destructive-foreground rounded-full">
                    {pendingRequests.length}
                  </span>
                )}
              </TabsTrigger>
            )}
            {(isAdmin || isModerator) && (
              <TabsTrigger value="settings">
                <Settings2 className="h-3.5 w-3.5 mr-1" />
                연차 설정
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="my" className="mt-4">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <LeaveRequestList
                requests={myRequests}
                isAdmin={false}
                currentUserId={user?.id || ''}
                onApprove={approveRequest}
                onReject={rejectRequest}
                onCancel={cancelRequest}
              />
            )}
          </TabsContent>

          {(isAdmin || isModerator) && (
            <TabsContent value="all" className="mt-4">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <LeaveRequestList
                  requests={requests}
                  isAdmin={true}
                  currentUserId={user?.id || ''}
                  onApprove={approveRequest}
                  onReject={rejectRequest}
                  onCancel={cancelRequest}
                />
              )}
            </TabsContent>
          )}
          {(isAdmin || isModerator) && (
            <TabsContent value="settings" className="mt-4">
              <LeavePolicySettings />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default LeaveManagementPage;
