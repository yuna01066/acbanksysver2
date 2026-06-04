import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  FilePenLine,
  Loader2,
  TimerReset,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, differenceInMinutes } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import QuickAttendanceButton from '@/components/QuickAttendanceButton';
import LeaveSummaryCards from '@/components/leave/LeaveSummaryCards';
import LeaveTypeCards from '@/components/leave/LeaveTypeCards';
import LeaveUsageHistory from '@/components/leave/LeaveUsageHistory';
import { MyPageMetricCard, MyPageSectionHeader } from '@/components/mypage/MyPageLayout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
  calculatePolicyBasedLeaveDays,
  useLeaveRequests,
} from '@/hooks/useLeaveRequests';
import { useLeaveAdjustments } from '@/hooks/useLeaveAdjustments';
import { useLeavePolicy } from '@/hooks/useLeavePolicy';
import { useMyHrProfile } from '@/hooks/useHrSelfService';
import { calculateExpiredLeave } from '@/utils/leaveExpiration';
import { cn } from '@/lib/utils';

type AttendanceRecord = Database['public']['Tables']['attendance_records']['Row'];
type AttendanceCorrectionRequest = Database['public']['Tables']['attendance_correction_requests']['Row'];

const leaveBalanceTypes = ['annual', 'monthly', 'half_am', 'half_pm'];

const formatHours = (hours: number) => `${hours.toFixed(1)}시간`;

const formatTime = (value?: string | null) => {
  if (!value) return '-';
  return format(new Date(value), 'HH:mm');
};

const toIsoFromDateTime = (date: string, time: string) => {
  if (!date || !time) return null;
  return new Date(`${date}T${time}:00+09:00`).toISOString();
};

const getElapsedLabel = (record?: AttendanceRecord | null) => {
  if (!record?.check_in) return '출근 전';
  const end = record.check_out ? new Date(record.check_out) : new Date();
  const minutes = Math.max(0, differenceInMinutes(end, new Date(record.check_in)));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}시간 ${rest}분`;
};

const getStatusLabel = (record?: AttendanceRecord | null) => {
  if (!record?.check_in) return { label: '미출근', className: 'bg-muted text-muted-foreground' };
  if (record.check_out) return { label: '퇴근 완료', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300' };
  return { label: '근무 중', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' };
};

const CorrectionStatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: '처리 대기', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' },
    handled: { label: '처리 완료', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' },
    rejected: { label: '반려', className: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300' },
    cancelled: { label: '취소', className: 'bg-muted text-muted-foreground' },
  };
  const info = config[status] || config.pending;
  return <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', info.className)}>{info.label}</span>;
};

const MyAttendanceLeaveSection: React.FC = () => {
  const { user, profile: authProfile } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useMyHrProfile();
  const { requests, loading, createRequest, cancelRequest } = useLeaveRequests();
  const { policy, loading: policyLoading, unitLabel, canRequest } = useLeavePolicy();
  const { getNetAdjustment } = useLeaveAdjustments(user?.id);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    requestType: 'both',
    requestedCheckIn: '',
    requestedCheckOut: '',
    reason: '',
    attendanceRecordId: null as string | null,
  });

  const today = format(new Date(), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  const { data: todayRecord, isLoading: todayLoading } = useQuery({
    queryKey: ['mypage-attendance-today', user?.id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', user!.id)
        .eq('date', today)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: monthlyRecords = [], isLoading: monthlyLoading } = useQuery({
    queryKey: ['mypage-attendance-monthly', user?.id, monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', user!.id)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: correctionRequests = [], isLoading: correctionLoading } = useQuery({
    queryKey: ['mypage-attendance-corrections', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_correction_requests')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const myRequests = useMemo(
    () => requests.filter((request) => request.user_id === user?.id),
    [requests, user?.id],
  );

  const leaveSummary = useMemo(() => {
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

  const attendanceSummary = useMemo(() => {
    const completed = monthlyRecords.filter(record => record.check_in && record.check_out);
    const missing = monthlyRecords.filter(record => record.check_in && !record.check_out && record.date < today);
    const flagged = monthlyRecords.filter(record => ['late', 'absent', 'early_leave'].includes(record.status));
    const pendingCorrections = correctionRequests.filter(request => request.status === 'pending').length;
    const workHours = monthlyRecords.reduce((sum, record) => sum + Number(record.work_hours || 0), 0);

    return {
      completedDays: completed.length,
      issueCount: new Set([...missing, ...flagged].map(record => record.id)).size,
      workHours,
      pendingCorrections,
    };
  }, [correctionRequests, monthlyRecords, today]);

  const openCorrectionDialog = (record?: AttendanceRecord | null) => {
    setCorrectionForm({
      date: record?.date || today,
      requestType: record?.check_in && !record.check_out ? 'check_out' : 'both',
      requestedCheckIn: record?.check_in ? format(new Date(record.check_in), 'HH:mm') : '',
      requestedCheckOut: record?.check_out ? format(new Date(record.check_out), 'HH:mm') : '',
      reason: '',
      attendanceRecordId: record?.id || null,
    });
    setCorrectionOpen(true);
  };

  const refreshAttendanceQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['mypage-attendance-today'] });
    queryClient.invalidateQueries({ queryKey: ['mypage-attendance-monthly'] });
  };

  const createCorrectionMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('로그인이 필요합니다.');
      const recordForDate = monthlyRecords.find(record => record.date === correctionForm.date);
      const attendanceRecordId = correctionForm.attendanceRecordId || recordForDate?.id || null;
      const { error } = await supabase.from('attendance_correction_requests').insert({
        user_id: user.id,
        user_name: profile?.full_name || authProfile?.full_name || user.email || '',
        attendance_record_id: attendanceRecordId,
        date: correctionForm.date,
        request_type: correctionForm.requestType,
        requested_check_in: ['check_in', 'both'].includes(correctionForm.requestType)
          ? toIsoFromDateTime(correctionForm.date, correctionForm.requestedCheckIn)
          : null,
        requested_check_out: ['check_out', 'both'].includes(correctionForm.requestType)
          ? toIsoFromDateTime(correctionForm.date, correctionForm.requestedCheckOut)
          : null,
        reason: correctionForm.reason.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('근태 정정 요청이 접수되었습니다.');
      setCorrectionOpen(false);
      setCorrectionForm({
        date: today,
        requestType: 'both',
        requestedCheckIn: '',
        requestedCheckOut: '',
        reason: '',
        attendanceRecordId: null,
      });
      queryClient.invalidateQueries({ queryKey: ['mypage-attendance-corrections'] });
    },
    onError: (error: any) => {
      toast.error('정정 요청 실패: ' + (error.message || '알 수 없는 오류'));
    },
  });

  const cancelCorrectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('attendance_correction_requests')
        .update({ status: 'cancelled' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('정정 요청이 취소되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['mypage-attendance-corrections'] });
    },
    onError: (error: any) => {
      toast.error('취소 실패: ' + (error.message || '알 수 없는 오류'));
    },
  });

  const hasRequestedTime = correctionForm.requestType === 'memo'
    || (correctionForm.requestType === 'check_in' && correctionForm.requestedCheckIn)
    || (correctionForm.requestType === 'check_out' && correctionForm.requestedCheckOut)
    || (correctionForm.requestType === 'both' && correctionForm.requestedCheckIn && correctionForm.requestedCheckOut);
  const canSubmitCorrection = Boolean(correctionForm.date && correctionForm.reason.trim().length >= 3 && hasRequestedTime);

  if (profileLoading || policyLoading || loading || todayLoading || monthlyLoading || correctionLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const todayStatus = getStatusLabel(todayRecord);
  const recentAttendance = monthlyRecords.slice(0, 6);
  const recentCorrections = correctionRequests.slice(0, 4);

  return (
    <div className="space-y-5">
      <MyPageSectionHeader
        title="근태·연차"
        description="오늘 출퇴근, 이번 달 기록, 연차 신청과 정정 요청을 한 화면에서 처리합니다."
        icon={<CalendarDays className="h-4 w-4" />}
      />

      {!profile?.join_date && (
        <Alert>
          <AlertTitle>입사일 확인 필요</AlertTitle>
          <AlertDescription>
            입사일이 등록되지 않아 연차가 정확히 계산되지 않을 수 있습니다. 내 인사정보 탭에서 변경 요청을 접수하세요.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,360px),1fr]">
        <Card className="border shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-primary" />
                  오늘 근태
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{format(new Date(), 'yyyy년 M월 d일 EEEE', { locale: ko })}</p>
              </div>
              <Badge className={todayStatus.className}>{todayStatus.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <QuickAttendanceButton onAttendanceChanged={refreshAttendanceQueries} variant="compact" />
            <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">출근</p>
                <p className="mt-1 font-semibold">{formatTime(todayRecord?.check_in)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">퇴근</p>
                <p className="mt-1 font-semibold">{formatTime(todayRecord?.check_out)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">경과</p>
                <p className="mt-1 font-semibold">{getElapsedLabel(todayRecord)}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => openCorrectionDialog(todayRecord)}>
              <FilePenLine className="h-4 w-4" />
              오늘 근태 정정 요청
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MyPageMetricCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="정상 기록"
            value={`${attendanceSummary.completedDays}일`}
            description="이번 달 출퇴근이 모두 기록된 일수"
            tone="success"
          />
          <MyPageMetricCard
            icon={<AlertCircle className="h-4 w-4" />}
            label="누락·오류"
            value={`${attendanceSummary.issueCount}건`}
            description="퇴근 누락, 지각, 결근 등 확인 필요 기록"
            tone={attendanceSummary.issueCount > 0 ? 'warning' : 'neutral'}
          />
          <MyPageMetricCard
            icon={<TimerReset className="h-4 w-4" />}
            label="총 근무시간"
            value={formatHours(attendanceSummary.workHours)}
            description="출퇴근이 완료된 기록 기준"
            tone="primary"
          />
          <MyPageMetricCard
            icon={<CalendarClock className="h-4 w-4" />}
            label="정정 대기"
            value={`${attendanceSummary.pendingCorrections}건`}
            description="관리자 확인을 기다리는 정정 요청"
            tone={attendanceSummary.pendingCorrections > 0 ? 'warning' : 'neutral'}
          />
        </div>
      </div>

      <LeaveSummaryCards
        totalDays={leaveSummary.totalDays}
        usedDays={leaveSummary.usedDays}
        pendingDays={leaveSummary.pendingDays}
        remainingDays={leaveSummary.remainingDays}
        unitLabel={unitLabel}
        allowAdvanceUse={policy.allow_advance_use}
        expiredDays={leaveSummary.expiration.expiredDays}
        expiringSoonDays={leaveSummary.expiration.expiringSoonDays}
        expirationDate={leaveSummary.expiration.expirationDate}
        compact
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),380px]">
        <Card className="border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">휴가 신청</CardTitle>
          </CardHeader>
          <CardContent>
            <LeaveTypeCards
              onSubmit={createRequest}
              remainingDays={leaveSummary.remainingDays}
              leavePolicy={policy}
              canRequest={canRequest}
            />
          </CardContent>
        </Card>

        <Card className="border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">최근 기록</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="attendance" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="attendance">근태</TabsTrigger>
                <TabsTrigger value="leave">휴가</TabsTrigger>
                <TabsTrigger value="correction">정정</TabsTrigger>
              </TabsList>

              <TabsContent value="attendance" className="mt-4 space-y-2">
                {recentAttendance.length === 0 ? (
                  <div className="rounded-lg border bg-muted/20 py-8 text-center text-sm text-muted-foreground">이번 달 근태 기록이 없습니다.</div>
                ) : (
                  recentAttendance.map(record => (
                    <div key={record.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{format(new Date(record.date), 'M월 d일 (EEE)', { locale: ko })}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatTime(record.check_in)} - {formatTime(record.check_out)}
                          {record.work_hours ? ` · ${formatHours(Number(record.work_hours))}` : ''}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => openCorrectionDialog(record)}>
                        정정
                      </Button>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="leave" className="mt-4 max-h-[420px] overflow-y-auto pr-1">
                <LeaveUsageHistory
                  requests={myRequests}
                  currentUserId={user?.id || ''}
                  onCancel={cancelRequest}
                  compact
                />
              </TabsContent>

              <TabsContent value="correction" className="mt-4 space-y-2">
                {recentCorrections.length === 0 ? (
                  <div className="rounded-lg border bg-muted/20 py-8 text-center text-sm text-muted-foreground">정정 요청 기록이 없습니다.</div>
                ) : (
                  recentCorrections.map(request => (
                    <div key={request.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{format(new Date(request.date), 'M월 d일 (EEE)', { locale: ko })}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{request.reason}</p>
                        </div>
                        <CorrectionStatusBadge status={request.status} />
                      </div>
                      {request.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-7 px-0 text-xs text-muted-foreground"
                          onClick={() => cancelCorrectionMutation.mutate(request.id)}
                          disabled={cancelCorrectionMutation.isPending}
                        >
                          요청 취소
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={correctionOpen} onOpenChange={setCorrectionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>근태 정정 요청</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="correction-date">날짜</Label>
              <Input
                id="correction-date"
                type="date"
                value={correctionForm.date}
                onChange={(event) => setCorrectionForm(form => ({ ...form, date: event.target.value, attendanceRecordId: null }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>정정 유형</Label>
              <Select value={correctionForm.requestType} onValueChange={(value) => setCorrectionForm(form => ({ ...form, requestType: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">출근/퇴근 시간</SelectItem>
                  <SelectItem value="check_in">출근 시간</SelectItem>
                  <SelectItem value="check_out">퇴근 시간</SelectItem>
                  <SelectItem value="memo">메모/기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {correctionForm.requestType !== 'memo' && (
              <div className="grid grid-cols-2 gap-3">
                {['check_in', 'both'].includes(correctionForm.requestType) && (
                  <div className="grid gap-2">
                    <Label htmlFor="requested-check-in">출근 시간</Label>
                    <Input
                      id="requested-check-in"
                      type="time"
                      value={correctionForm.requestedCheckIn}
                      onChange={(event) => setCorrectionForm(form => ({ ...form, requestedCheckIn: event.target.value }))}
                    />
                  </div>
                )}
                {['check_out', 'both'].includes(correctionForm.requestType) && (
                  <div className="grid gap-2">
                    <Label htmlFor="requested-check-out">퇴근 시간</Label>
                    <Input
                      id="requested-check-out"
                      type="time"
                      value={correctionForm.requestedCheckOut}
                      onChange={(event) => setCorrectionForm(form => ({ ...form, requestedCheckOut: event.target.value }))}
                    />
                  </div>
                )}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="correction-reason">사유</Label>
              <Textarea
                id="correction-reason"
                value={correctionForm.reason}
                onChange={(event) => setCorrectionForm(form => ({ ...form, reason: event.target.value }))}
                placeholder="예: 외근 후 퇴근 기록 누락, 출근 시간 오입력"
                rows={4}
              />
            </div>
            <Alert>
              <AlertDescription className="text-xs">
                요청은 관리자에게 전달됩니다. 실제 근태 반영은 관리자 확인 후 기존 근태 관리에서 처리됩니다.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionOpen(false)}>취소</Button>
            <Button
              onClick={() => createCorrectionMutation.mutate()}
              disabled={!canSubmitCorrection || createCorrectionMutation.isPending}
            >
              {createCorrectionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              요청 보내기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyAttendanceLeaveSection;
