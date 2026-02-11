import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, CalendarDays, Clock, Loader2, Plus, Settings2 } from 'lucide-react';
import { useLeaveRequests, calculatePolicyBasedLeaveDays, LEAVE_TYPES, calculateBusinessDays } from '@/hooks/useLeaveRequests';
import AdminLeaveOverview from '@/components/leave/AdminLeaveOverview';
import { useLeavePolicy } from '@/hooks/useLeavePolicy';
import { useQuery } from '@tanstack/react-query';
import { calculateExpiredLeave } from '@/utils/leaveExpiration';
import { toast } from 'sonner';
import LeaveSummaryCards from '@/components/leave/LeaveSummaryCards';
import LeaveDetailTable from '@/components/leave/LeaveDetailTable';
import LeavePolicySettings from '@/components/leave/LeavePolicySettings';
import LeaveTypeCards from '@/components/leave/LeaveTypeCards';
import LeaveUsageHistory from '@/components/leave/LeaveUsageHistory';
import LeaveRequestList from '@/components/leave/LeaveRequestList';

const LeaveManagementPage = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, isModerator, loading: authLoading } = useAuth();
  const { requests, loading, createRequest, approveRequest, rejectRequest, cancelRequest, refresh } = useLeaveRequests();
  const { policy, loading: policyLoading, unitLabel, canRequest } = useLeavePolicy();
  const [joinDate, setJoinDate] = useState<string>('');

  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    userId: '', userName: '', leaveType: 'annual', startDate: '', endDate: '', reason: '',
  });
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const { data: employees = [] } = useQuery({
    queryKey: ['approved-profiles-leave'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, join_date, department').eq('is_approved', true).order('full_name');
      return data || [];
    },
    enabled: isAdmin || isModerator,
  });

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

  const totalAnnualDays = useMemo(
    () => calculatePolicyBasedLeaveDays(joinDate, policy.grant_method, policy.grant_basis),
    [joinDate, policy.grant_method, policy.grant_basis]
  );

  const myRequests = useMemo(() => requests.filter(r => r.user_id === user?.id), [requests, user]);
  const pendingRequests = useMemo(() => requests.filter(r => r.status === 'pending'), [requests]);

  const usedDays = useMemo(() =>
    myRequests.filter(r => r.status === 'approved' && (r.leave_type === 'annual' || r.leave_type === 'monthly' || r.leave_type === 'half_am' || r.leave_type === 'half_pm'))
      .reduce((sum, r) => sum + r.days, 0),
    [myRequests]
  );
  const usedMonthlyDays = useMemo(() =>
    myRequests.filter(r => r.status === 'approved' && (r.leave_type === 'monthly' || r.leave_type === 'annual'))
      .reduce((sum, r) => sum + r.days, 0),
    [myRequests]
  );
  const pendingDays = useMemo(() =>
    myRequests.filter(r => r.status === 'pending' && (r.leave_type === 'annual' || r.leave_type === 'monthly' || r.leave_type === 'half_am' || r.leave_type === 'half_pm'))
      .reduce((sum, r) => sum + r.days, 0),
    [myRequests]
  );

  const expiration = useMemo(() => {
    if (!policy.auto_expire_enabled) {
      return { expiredDays: 0, expiringSoonDays: 0, expirationDate: null, details: [] };
    }
    return calculateExpiredLeave(
      joinDate, policy.grant_basis, policy.auto_expire_type, usedDays, usedMonthlyDays,
    );
  }, [joinDate, policy.grant_basis, policy.auto_expire_type, policy.auto_expire_enabled, usedDays, usedMonthlyDays]);

  const remainingDays = totalAnnualDays - usedDays - expiration.expiredDays;

  const handleManualLeaveSubmit = async () => {
    if (!manualForm.userId || !manualForm.startDate || !manualForm.endDate) {
      toast.warning('직원, 시작일, 종료일을 모두 입력해주세요.');
      return;
    }
    setManualSubmitting(true);
    try {
      const isHalf = manualForm.leaveType === 'half_am' || manualForm.leaveType === 'half_pm';
      const days = isHalf ? 0.5 : calculateBusinessDays(manualForm.startDate, manualForm.endDate);

      const { error } = await supabase.from('leave_requests').insert({
        user_id: manualForm.userId,
        user_name: manualForm.userName,
        leave_type: manualForm.leaveType,
        start_date: manualForm.startDate,
        end_date: isHalf ? manualForm.startDate : manualForm.endDate,
        days,
        reason: manualForm.reason || null,
        status: 'approved',
        approved_by: user?.id,
        approved_by_name: profile?.full_name,
        approved_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success(`${manualForm.userName}님의 휴가가 등록되었습니다.`);
      setManualOpen(false);
      setManualForm({ userId: '', userName: '', leaveType: 'annual', startDate: '', endDate: '', reason: '' });
      refresh();
    } catch (e: any) {
      toast.error('등록 실패: ' + (e.message || ''));
    } finally {
      setManualSubmitting(false);
    }
  };

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
          <h1 className="text-lg font-semibold">내 휴가</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/attendance')} className="gap-1">
          <Clock className="h-4 w-4" />
          근태 관리
        </Button>
      </div>

      <div className="container max-w-5xl mx-auto px-4 py-6">
        <Tabs defaultValue="overview">
          <TabsList className="bg-transparent border-b rounded-none w-full justify-start px-0 h-auto pb-0">
            <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3">
              휴가 개요
            </TabsTrigger>
            <TabsTrigger value="detail" className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3">
              연차 상세
            </TabsTrigger>
            <TabsTrigger value="plan" className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3">
              연차 사용 계획
            </TabsTrigger>
            {(isAdmin || isModerator) && (
              <TabsTrigger value="admin" className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 relative">
                전체 관리
                {pendingRequests.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs bg-destructive text-destructive-foreground rounded-full">
                    {pendingRequests.length}
                  </span>
                )}
              </TabsTrigger>
            )}
            {(isAdmin || isModerator) && (
              <TabsTrigger value="settings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3">
                <Settings2 className="h-3.5 w-3.5 mr-1" />
                연차 설정
              </TabsTrigger>
            )}
          </TabsList>

          {/* 휴가 개요 Tab */}
          <TabsContent value="overview" className="mt-6 space-y-8">
            {!joinDate && (
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 p-3 text-sm text-yellow-800 dark:text-yellow-300">
                ⚠️ 입사일이 등록되지 않아 연차가 0일로 계산됩니다. 마이페이지 또는 관리자에게 입사일 등록을 요청하세요.
              </div>
            )}

            <LeaveTypeCards
              onSubmit={createRequest}
              remainingDays={remainingDays}
              leavePolicy={policy}
              canRequest={canRequest}
            />

            <LeaveUsageHistory
              requests={myRequests}
              currentUserId={user?.id || ''}
              onCancel={cancelRequest}
            />
          </TabsContent>

          {/* 연차 상세 Tab */}
          <TabsContent value="detail" className="mt-6 space-y-6">
            <LeaveDetailTable
              joinDate={joinDate}
              requests={myRequests}
              grantMethod={policy.grant_method}
              grantBasis={policy.grant_basis}
            />
          </TabsContent>

          {/* 연차 사용 계획 Tab */}
          <TabsContent value="plan" className="mt-6">
            <div className="rounded-lg border bg-muted/30 py-12 flex flex-col items-center justify-center text-muted-foreground">
              <CalendarDays className="h-8 w-8 mb-3" />
              <p className="text-sm font-medium">연차 사용 계획 기능</p>
              <p className="text-xs mt-1">준비 중입니다.</p>
            </div>
          </TabsContent>

          {/* 전체 관리 Tab (Admin) */}
          {(isAdmin || isModerator) && (
            <TabsContent value="admin" className="mt-6 space-y-4">
              <div className="flex justify-end">
                <Dialog open={manualOpen} onOpenChange={setManualOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1">
                      <Plus className="h-4 w-4" />
                      수동 등록
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>직원 휴가 수동 등록</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                      <div>
                        <Label className="text-sm">직원 선택</Label>
                        <Select
                          value={manualForm.userId}
                          onValueChange={(val) => {
                            const emp = employees.find(e => e.id === val);
                            setManualForm(f => ({ ...f, userId: val, userName: emp?.full_name || '' }));
                          }}
                        >
                          <SelectTrigger className="mt-1"><SelectValue placeholder="직원을 선택하세요" /></SelectTrigger>
                          <SelectContent>
                            {employees.map(e => (
                              <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm">휴가 유형</Label>
                        <Select value={manualForm.leaveType} onValueChange={(val) => setManualForm(f => ({ ...f, leaveType: val }))}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(LEAVE_TYPES).map(([key, label]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm">시작일</Label>
                          <Input type="date" value={manualForm.startDate} onChange={e => setManualForm(f => ({ ...f, startDate: e.target.value }))} className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-sm">종료일</Label>
                          <Input
                            type="date"
                            value={manualForm.leaveType === 'half_am' || manualForm.leaveType === 'half_pm' ? manualForm.startDate : manualForm.endDate}
                            onChange={e => setManualForm(f => ({ ...f, endDate: e.target.value }))}
                            disabled={manualForm.leaveType === 'half_am' || manualForm.leaveType === 'half_pm'}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm">사유 (선택)</Label>
                        <Textarea value={manualForm.reason} onChange={e => setManualForm(f => ({ ...f, reason: e.target.value }))} placeholder="사유를 입력하세요" className="mt-1" />
                      </div>
                      <p className="text-xs text-muted-foreground">※ 관리자가 수동 등록한 휴가는 즉시 승인 상태로 등록됩니다.</p>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setManualOpen(false)}>취소</Button>
                        <Button onClick={handleManualLeaveSubmit} disabled={manualSubmitting}>
                          {manualSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                          등록
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <AdminLeaveOverview
                employees={employees}
                allRequests={requests}
                grantMethod={policy.grant_method}
                grantBasis={policy.grant_basis}
              />

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
            <TabsContent value="settings" className="mt-6">
              <LeavePolicySettings />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default LeaveManagementPage;
