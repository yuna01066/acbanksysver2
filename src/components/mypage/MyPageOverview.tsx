import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  AlertCircle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Loader2,
  PenLine,
  Receipt,
  Wallet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import QuickAttendanceButton from '@/components/QuickAttendanceButton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLeaveRequests, calculatePolicyBasedLeaveDays } from '@/hooks/useLeaveRequests';
import { useLeavePolicy } from '@/hooks/useLeavePolicy';
import { useLeaveAdjustments } from '@/hooks/useLeaveAdjustments';
import { useDocumentBox, useEmployeeDocuments } from '@/hooks/useDocumentBox';
import { useNotifications } from '@/hooks/useNotifications';
import { TAX_YEAR, STATUS_LABELS, useYearEndTax } from '@/hooks/useYearEndTax';
import { useEmployeeHrTasks, useMyHrProfile, usePayStatements, useProfileChangeReviewQueue } from '@/hooks/useHrSelfService';
import { cn } from '@/lib/utils';

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
  'profile_change_approved',
  'profile_change_rejected',
  'profile_change_request',
  'hr_request',
  'hr_request_update',
  'hr_task',
]);

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
  const hrNotifications = notifications.filter((notification) => !notification.is_read && hrNotificationTypes.has(notification.type));
  const latestPay = payStatements[0];
  const taxStatus = tax.settlement?.status || 'not_started';
  const taxStatusLabel = STATUS_LABELS[taxStatus]?.label || '미시작';

  const isLoading = contractsLoading || tasksLoading || tax.loading;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="border">
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
              </div>
            )}
          </CardContent>
        </Card>

        <QuickAttendanceButton />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="border">
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

        <Card className="border">
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
          <Card className="border">
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
          <Card className="border">
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
    </div>
  );
};

export default MyPageOverview;
