import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { addDays, format, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  AlertCircle,
  Bell,
  Briefcase,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  CheckSquare2,
  ChevronRight,
  Clock3,
  ClipboardCheck,
  FileText,
  GraduationCap,
  ListChecks,
  Loader2,
  PenLine,
  Plus,
  Receipt,
  Wallet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import QuickAttendanceButton from '@/components/QuickAttendanceButton';
import CalendarEventDialog from '@/components/calendar/CalendarEventDialog';
import { MyPageActionPanel, MyPageEmptyState, MyPageSectionHeader } from '@/components/mypage/MyPageLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLeaveRequests, calculatePolicyBasedLeaveDays } from '@/hooks/useLeaveRequests';
import { useLeavePolicy } from '@/hooks/useLeavePolicy';
import { useLeaveAdjustments } from '@/hooks/useLeaveAdjustments';
import { useDocumentBox, useEmployeeDocuments } from '@/hooks/useDocumentBox';
import { useNotifications } from '@/hooks/useNotifications';
import { useCalendarEvents, useCalendarTasks, useCreateCalendarTask, useUpdateCalendarTask } from '@/hooks/useInternalCalendar';
import { TAX_YEAR, STATUS_LABELS, useYearEndTax } from '@/hooks/useYearEndTax';
import { useEmployeeHrTasks, useMyHrProfile, usePayStatements, useProfileChangeReviewQueue } from '@/hooks/useHrSelfService';
import { cn } from '@/lib/utils';
import type { CalendarTask, InternalCalendarEvent } from '@/types/internalCalendar';
import { toast } from 'sonner';

type OverviewMetricProps = {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'neutral' | 'primary' | 'warning' | 'danger' | 'success';
  actionLabel?: string;
  onClick?: () => void;
};

const toneClass = {
  neutral: 'border-border bg-card text-foreground',
  primary: 'border-primary/20 bg-primary/5 text-primary',
  warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300',
  danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300',
} as const;

const hrNotificationTypes = new Set([
  'leave_request',
  'leave_approved',
  'leave_rejected',
  'leave_expiry_warning',
  'leave_promotion_summary',
  'attendance_correction_request',
  'peer_feedback',
  'performance_review_summary',
  'contract_request',
  'contract_signed',
  'contract_rejected',
  'contract_withdrawn',
  'profile_change_approved',
  'profile_change_rejected',
  'profile_change_request',
  'hr_request',
  'hr_request_update',
  'hr_task',
]);

function isPersonalCalendarEvent(event: InternalCalendarEvent, userId?: string) {
  if (!userId || event.created_by !== userId || event.source_type !== 'manual') return false;
  return event.source_subtype === 'personal' || event.metadata?.calendar_kind === 'personal';
}

function formatScheduleTime(event: InternalCalendarEvent) {
  if (event.all_day) return '종일';
  return format(new Date(event.starts_at), 'HH:mm');
}

function getSchedulePath(dateKey: string) {
  return `/my-page?tab=schedule&view=day&date=${dateKey}`;
}

function OverviewMetric({
  title,
  value,
  description,
  icon: Icon,
  tone = 'neutral',
  actionLabel,
  onClick,
}: OverviewMetricProps) {
  return (
    <Card className="h-full border">
      <CardContent className="flex h-full min-h-[132px] flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="mt-1 truncate text-2xl font-bold tracking-normal">{value}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{description}</p>
          </div>
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border', toneClass[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {actionLabel && onClick && (
          <Button variant="ghost" size="sm" className="mt-3 h-8 justify-start px-0 text-xs" onClick={onClick}>
            {actionLabel}
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

const MyPageOverview: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isModerator } = useAuth();
  const [personalEventDialogOpen, setPersonalEventDialogOpen] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const canReview = isAdmin || isModerator;
  const { data: hrProfile } = useMyHrProfile();
  const { requests } = useLeaveRequests();
  const { policy } = useLeavePolicy();
  const { getNetAdjustment } = useLeaveAdjustments(user?.id);
  const { categories = [] } = useDocumentBox();
  const { documents = [] } = useEmployeeDocuments(user?.id);
  const { notifications } = useNotifications();
  const tax = useYearEndTax(TAX_YEAR);
  const { data: tasks = [], isLoading: tasksLoading } = useEmployeeHrTasks();
  const { data: payStatements = [] } = usePayStatements();
  const { data: reviewQueue = [] } = useProfileChangeReviewQueue(canReview);
  const todayStart = startOfDay(new Date());
  const todayEnd = addDays(todayStart, 1);
  const todayDateKey = format(todayStart, 'yyyy-MM-dd');
  const { data: calendarEvents = [], isLoading: calendarLoading } = useCalendarEvents({
    rangeStart: todayStart.toISOString(),
    rangeEnd: todayEnd.toISOString(),
    scope: 'my',
    enabled: !!user,
  });
  const { data: calendarTasks = [], isLoading: calendarTasksLoading } = useCalendarTasks({
    rangeStart: todayStart.toISOString(),
    rangeEnd: todayEnd.toISOString(),
    enabled: !!user,
  });
  const createCalendarTask = useCreateCalendarTask();
  const updateCalendarTask = useUpdateCalendarTask();

  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['my-contract-summary', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employment_contracts')
        .select('id,status,contract_start_date,contract_end_date,created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const leaveSummary = useMemo(() => {
    const myRequests = requests.filter((request) => request.user_id === user?.id);
    const totalDays = calculatePolicyBasedLeaveDays(
      hrProfile?.join_date || '',
      policy.grant_method,
      policy.grant_basis,
    ) + (user ? getNetAdjustment(user.id) : 0);
    const usedDays = myRequests
      .filter((request) => request.status === 'approved' && ['annual', 'monthly', 'half_am', 'half_pm'].includes(request.leave_type))
      .reduce((sum, request) => sum + Number(request.days || 0), 0);
    const pendingDays = myRequests
      .filter((request) => request.status === 'pending' && ['annual', 'monthly', 'half_am', 'half_pm'].includes(request.leave_type))
      .reduce((sum, request) => sum + Number(request.days || 0), 0);
    return {
      totalDays,
      usedDays,
      pendingDays,
      remainingDays: totalDays - usedDays,
      pendingCount: myRequests.filter((request) => request.status === 'pending').length,
    };
  }, [getNetAdjustment, hrProfile?.join_date, policy.grant_basis, policy.grant_method, requests, user]);

  const pendingContracts = contracts.filter((contract) => ['requested', 'opened'].includes(contract.status)).length;
  const signedContracts = contracts.filter((contract) => contract.status === 'signed').length;
  const missingDocuments = categories.filter((category) => {
    if (!category.is_active) return false;
    return documents.filter((document) => document.category_id === category.id).length === 0;
  });
  const pendingTasks = tasks.filter((task) => task.status !== 'completed' && task.status !== 'cancelled');
  const todayEvents = calendarEvents
    .filter((event) => new Date(event.starts_at).getTime() < todayEnd.getTime() && new Date(event.ends_at).getTime() > todayStart.getTime())
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const personalTodayEvents = todayEvents.filter((event) => isPersonalCalendarEvent(event, user?.id));
  const openCalendarTasks = calendarTasks
    .filter((task) => task.task_date === todayDateKey && task.status !== 'completed' && task.status !== 'archived')
    .sort((a, b) => a.title.localeCompare(b.title, 'ko'));
  const hrNotifications = notifications.filter((notification) => !notification.is_read && hrNotificationTypes.has(notification.type));
  const latestPay = payStatements[0];
  const taxStatus = tax.settlement?.status || 'not_started';
  const taxStatusLabel = STATUS_LABELS[taxStatus]?.label || '미시작';

  const isLoading = contractsLoading || tasksLoading || tax.loading || calendarLoading || calendarTasksLoading;
  const focusItems = [
    pendingContracts > 0
      ? {
        id: 'contracts',
        title: `서명 대기 계약 ${pendingContracts}건`,
        description: '전자계약을 검토하고 서명해야 합니다.',
        icon: PenLine,
        tone: 'warning' as const,
        path: '/my-page?tab=contract',
      }
      : null,
    missingDocuments.length > 0
      ? {
        id: 'documents',
        title: `제출 필요 문서 ${missingDocuments.length}건`,
        description: missingDocuments.slice(0, 2).map((item) => item.name).join(', '),
        icon: FileText,
        tone: 'warning' as const,
        path: '/my-page?tab=documents',
      }
      : null,
    pendingTasks.length > 0
      ? {
        id: 'tasks',
        title: `진행 중 HR 과제 ${pendingTasks.length}건`,
        description: pendingTasks[0]?.title || '관리자가 배정한 과제를 확인하세요.',
        icon: GraduationCap,
        tone: 'primary' as const,
        path: '/my-page?tab=tasks',
      }
      : null,
    openCalendarTasks.length > 0
      ? {
        id: 'calendar-tasks',
        title: `오늘 할 일 ${openCalendarTasks.length}건`,
        description: openCalendarTasks[0]?.title || '오늘 개인 스케줄을 확인하세요.',
        icon: ListChecks,
        tone: 'primary' as const,
        path: getSchedulePath(todayDateKey),
      }
      : null,
    hrNotifications.length > 0
      ? {
        id: 'notifications',
        title: `새 HR 알림 ${hrNotifications.length}건`,
        description: hrNotifications[0]?.title || '알림 내용을 확인하세요.',
        icon: Bell,
        tone: 'warning' as const,
        path: '/my-page?tab=overview',
      }
      : null,
  ].filter(Boolean);

  const schedulePath = getSchedulePath(todayDateKey);
  const schedulePreviewEvents = personalTodayEvents.slice(0, 3);
  const schedulePreviewTasks = openCalendarTasks.slice(0, 3);
  const hasSchedulePreview = schedulePreviewEvents.length > 0 || schedulePreviewTasks.length > 0;
  const quickTaskBusy = createCalendarTask.isPending || updateCalendarTask.isPending;

  const handleQuickTaskSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = quickTaskTitle.trim();
    if (!title) {
      toast.error('추가할 할 일을 입력해주세요.');
      return;
    }
    try {
      await createCalendarTask.mutateAsync({
        title,
        task_date: todayDateKey,
        priority: 'normal',
        status: 'open',
      });
      setQuickTaskTitle('');
      toast.success('오늘 할 일이 추가되었습니다.');
    } catch (error: any) {
      toast.error(error?.message || '할 일 추가에 실패했습니다.');
    }
  };

  const handleToggleTask = async (task: CalendarTask) => {
    const nextStatus = task.status === 'completed' ? 'open' : 'completed';
    try {
      await updateCalendarTask.mutateAsync({
        id: task.id,
        title: task.title,
        description: task.description,
        task_date: task.task_date,
        priority: task.priority,
        status: nextStatus,
        linked_event_id: task.linked_event_id,
      });
      toast.success(nextStatus === 'completed' ? '할 일을 완료했습니다.' : '할 일을 다시 열었습니다.');
    } catch (error: any) {
      toast.error(error?.message || '할 일 상태 변경에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      <MyPageSectionHeader
        title="개요"
        description="오늘 처리할 HR 업무와 내 상태를 먼저 확인합니다."
        icon={<ClipboardCheck className="h-4 w-4" />}
      />

      <MyPageActionPanel title="오늘 처리 필요" description="서명, 문서 제출, 과제, 알림처럼 당장 확인해야 할 항목만 모았습니다.">
        {isLoading ? (
          <div className="flex min-h-[86px] items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            처리 항목을 불러오는 중입니다.
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="rounded-lg border bg-background p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">오늘 개인 스케줄</p>
                    <Badge variant="outline" className="rounded-full text-[11px]">
                      일정 {personalTodayEvents.length} · 할 일 {openCalendarTasks.length}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    개인 일정과 오늘 할 일을 빠르게 확인하고 추가합니다.
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" className="h-8 rounded-full" onClick={() => setPersonalEventDialogOpen(true)}>
                    <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                    일정 추가
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 rounded-full" onClick={() => navigate(schedulePath)}>
                    전체보기
                    <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {hasSchedulePreview ? (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">개인 일정</p>
                    {schedulePreviewEvents.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                        오늘 등록된 개인 일정이 없습니다.
                      </div>
                    ) : (
                      schedulePreviewEvents.map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent/30"
                          onClick={() => navigate(schedulePath)}
                        >
                          <Clock3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="w-11 shrink-0 text-xs font-semibold text-foreground">{formatScheduleTime(event)}</span>
                          <span className="min-w-0 truncate text-xs text-muted-foreground">{event.title}</span>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">오늘 할 일</p>
                    {schedulePreviewTasks.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                        오늘 남은 개인 할 일이 없습니다.
                      </div>
                    ) : (
                      schedulePreviewTasks.map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent/30"
                          onClick={() => handleToggleTask(task)}
                          disabled={quickTaskBusy}
                        >
                          <CheckSquare2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{task.title}</span>
                          <Badge variant="outline" className="shrink-0 rounded-full text-[10px]">
                            완료 처리
                          </Badge>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                  오늘 등록된 개인 스케줄이 없습니다.
                </div>
              )}

              <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={handleQuickTaskSubmit}>
                <Input
                  value={quickTaskTitle}
                  onChange={(event) => setQuickTaskTitle(event.target.value)}
                  placeholder="오늘 할 일 빠르게 추가"
                  className="h-9 text-sm"
                />
                <Button type="submit" size="sm" className="h-9 shrink-0" disabled={quickTaskBusy}>
                  {createCalendarTask.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                  할 일 추가
                </Button>
              </form>
            </div>

            {focusItems.length === 0 ? (
              <MyPageEmptyState title="오늘 바로 처리할 HR 업무가 없습니다." description="필요한 항목이 생기면 이 영역에 먼저 표시됩니다." />
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-1">
                {focusItems.slice(0, 6).map((item) => {
                  if (!item) return null;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="flex items-start gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:bg-accent/30"
                      onClick={() => navigate(item.path)}
                    >
                      <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', toneClass[item.tone])}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </MyPageActionPanel>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              HR 처리 현황
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex min-h-[180px] items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                내 HR 현황을 불러오는 중입니다.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <OverviewMetric
                  title="오늘 일정"
                  value={`${personalTodayEvents.length}건`}
                  description={personalTodayEvents[0]?.title || '오늘 등록된 개인 일정이 없습니다.'}
                  icon={CalendarDays}
                  tone={personalTodayEvents.length > 0 ? 'primary' : 'neutral'}
                  actionLabel="일정 열기"
                  onClick={() => navigate(schedulePath)}
                />
                <OverviewMetric
                  title="내 할 일"
                  value={`${openCalendarTasks.length}건`}
                  description={openCalendarTasks[0]?.title || '오늘 남은 할 일이 없습니다.'}
                  icon={ListChecks}
                  tone={openCalendarTasks.length > 0 ? 'warning' : 'success'}
                  actionLabel="스케줄 열기"
                  onClick={() => navigate(schedulePath)}
                />
                <OverviewMetric
                  title="잔여 연차"
                  value={`${leaveSummary.remainingDays.toFixed(1)}일`}
                  description={`승인 대기 ${leaveSummary.pendingDays.toFixed(1)}일 · 사용 ${leaveSummary.usedDays.toFixed(1)}일`}
                  icon={CalendarDays}
                  tone={leaveSummary.remainingDays < 2 ? 'warning' : 'primary'}
                  actionLabel="연차 신청"
                  onClick={() => navigate('/my-page?tab=attendance')}
                />
                <OverviewMetric
                  title="계약서"
                  value={pendingContracts > 0 ? `${pendingContracts}건 대기` : `${signedContracts}건 완료`}
                  description={pendingContracts > 0 ? '전자서명이 필요한 계약서가 있습니다.' : '서명 대기 중인 계약서가 없습니다.'}
                  icon={PenLine}
                  tone={pendingContracts > 0 ? 'warning' : 'success'}
                  actionLabel="계약 확인"
                  onClick={() => navigate('/my-page?tab=contract')}
                />
                <OverviewMetric
                  title="문서 제출"
                  value={missingDocuments.length > 0 ? `${missingDocuments.length}건 필요` : '완료'}
                  description={missingDocuments.length > 0 ? missingDocuments.slice(0, 2).map((item) => item.name).join(', ') : '필수 문서함 제출 상태가 정상입니다.'}
                  icon={FileText}
                  tone={missingDocuments.length > 0 ? 'warning' : 'success'}
                  actionLabel="문서함 열기"
                  onClick={() => navigate('/my-page?tab=documents')}
                />
                <OverviewMetric
                  title="연말정산"
                  value={taxStatusLabel}
                  description={`${TAX_YEAR}년 귀속 연말정산 진행 상태입니다.`}
                  icon={Receipt}
                  tone={taxStatus === 'submitted' || taxStatus === 'reviewed' || taxStatus === 'approved' ? 'success' : 'neutral'}
                  actionLabel="자료 확인"
                  onClick={() => navigate('/my-page?tab=tax')}
                />
                <OverviewMetric
                  title="급여명세"
                  value={latestPay ? format(new Date(latestPay.pay_month), 'yyyy.MM', { locale: ko }) : '미등록'}
                  description={latestPay?.net_pay ? `최근 실지급액 ${Number(latestPay.net_pay).toLocaleString()}원` : '게시된 급여명세가 없습니다.'}
                  icon={Wallet}
                  tone="neutral"
                  actionLabel="급여 확인"
                  onClick={() => navigate('/my-page?tab=contract')}
                />
                <OverviewMetric
                  title="교육·온보딩"
                  value={pendingTasks.length > 0 ? `${pendingTasks.length}건` : '완료'}
                  description={pendingTasks[0]?.title || '대기 중인 HR 과제가 없습니다.'}
                  icon={GraduationCap}
                  tone={pendingTasks.length > 0 ? 'primary' : 'success'}
                  actionLabel="과제 보기"
                  onClick={() => navigate('/my-page?tab=tasks')}
                />
                <OverviewMetric
                  title="업무·평가"
                  value="확인"
                  description="업무평가 결과와 피드백을 한 곳에서 확인합니다."
                  icon={Briefcase}
                  tone="neutral"
                  actionLabel="업무 탭 열기"
                  onClick={() => navigate('/my-page?tab=business')}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <QuickAttendanceButton variant="compact" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bell className="h-4 w-4 text-primary" />
              HR 알림
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {hrNotifications.length === 0 ? (
              <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                새 HR 알림이 없습니다.
              </div>
            ) : (
              hrNotifications.slice(0, 4).map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/30"
                  onClick={() => navigate('/my-page?tab=overview')}
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{notification.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{notification.description}</p>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <GraduationCap className="h-4 w-4 text-primary" />
              가까운 과제
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingTasks.length === 0 ? (
              <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                완료할 교육·온보딩 과제가 없습니다.
              </div>
            ) : (
              pendingTasks.slice(0, 4).map((task) => (
                <div key={task.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{task.title}</p>
                      {task.due_date && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          마감 {format(new Date(task.due_date), 'yyyy.MM.dd', { locale: ko })}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[11px]">
                      {task.status === 'in_progress' ? '진행중' : '대기'}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {canReview ? (
          <Card className="border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                관리자 검토
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">인사정보 변경 요청</p>
                  <p className="text-xs text-muted-foreground">승인 대기 중인 요청</p>
                </div>
                <Badge className={reviewQueue.length > 0 ? 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/10' : ''}>
                  {reviewQueue.length}건
                </Badge>
              </div>
              <Button variant="outline" size="sm" className="w-full justify-between" onClick={() => navigate('/my-page?tab=profile')}>
                검토 화면으로 이동
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                내 정보 상태
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium">{hrProfile?.department || '부서 미등록'}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {hrProfile?.position || '직책 미등록'}
                  {hrProfile?.employee_number ? ` · 사번 ${hrProfile.employee_number}` : ''}
                </p>
              </div>
              <Button variant="outline" size="sm" className="w-full justify-between" onClick={() => navigate('/my-page?tab=profile')}>
                인사정보 확인
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      <CalendarEventDialog
        open={personalEventDialogOpen}
        onOpenChange={setPersonalEventDialogOpen}
        events={personalTodayEvents}
        defaultDate={todayDateKey}
        defaultStartTime="09:00"
        defaultMode="personal"
        personalOnly
      />
    </div>
  );
};

export default MyPageOverview;
