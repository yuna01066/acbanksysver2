import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  FolderOpen,
  HardDrive,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { AppNotification } from '@/hooks/useNotifications';
import { BrandedCardHeader } from '@/components/ui/branded-card-header';

interface TodayWorkCardProps {
  notifications: AppNotification[];
}

type WorkItemTone = 'danger' | 'warning' | 'primary' | 'neutral' | 'success';

interface WorkItem {
  id: string;
  title: string;
  description: string;
  label: string;
  tone: WorkItemTone;
  icon: React.ReactNode;
  actionLabel: string;
  onClick: () => void;
}

interface UpcomingQuote {
  id: string;
  quote_number: string;
  project_name: string | null;
  recipient_company: string | null;
  desired_delivery_date: string | null;
  project_stage: string;
  user_id: string;
}

interface ActiveProject {
  id: string;
  name: string;
  status: string;
  updated_at: string;
  user_id: string;
}

interface PendingLeaveRequest {
  id: string;
  user_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
}

interface DocumentSyncSummary {
  pending: number;
  failed: number;
}

const todayString = () => format(new Date(), 'yyyy-MM-dd');
const plusDaysString = (days: number) => format(addDays(new Date(), days), 'yyyy-MM-dd');

function getNotificationPath(notification: AppNotification): string {
  if (notification.type === 'project_mention' && notification.data?.projectId) {
    return `/project-management?id=${notification.data.projectId}`;
  }
  if ((notification.type === 'quote_update' || notification.type === 'quote_modified') && notification.data?.quoteId) {
    return `/saved-quotes/${notification.data.quoteId}`;
  }
  if (notification.type === 'leave_request' || notification.type === 'leave_approved' || notification.type === 'leave_rejected') {
    return '/leave-management';
  }
  if (notification.type === 'peer_feedback') return '/my-page';
  if (notification.type === 'performance_review_summary') return '/my-page?tab=business';
  return '/announcements';
}

function formatDueLabel(dateString: string | null): { label: string; tone: WorkItemTone } {
  if (!dateString) return { label: '납기 미정', tone: 'neutral' };

  const target = parseISO(dateString);
  const diff = differenceInCalendarDays(target, new Date());

  if (diff < 0) return { label: `${Math.abs(diff)}일 지연`, tone: 'danger' };
  if (diff === 0) return { label: '오늘 납기', tone: 'danger' };
  if (diff <= 2) return { label: `${diff}일 남음`, tone: 'warning' };
  return { label: format(target, 'M월 d일', { locale: ko }), tone: 'primary' };
}

function toneClasses(tone: WorkItemTone): string {
  switch (tone) {
    case 'danger':
      return 'border-red-200/70 bg-red-50/70 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300';
    case 'warning':
      return 'border-amber-200/70 bg-amber-50/70 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300';
    case 'primary':
      return 'border-primary/20 bg-primary/5 text-primary';
    case 'success':
      return 'border-emerald-200/70 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300';
    default:
      return 'border-border bg-muted/40 text-muted-foreground';
  }
}

const TodayWorkCard = ({ notifications }: TodayWorkCardProps) => {
  const navigate = useNavigate();
  const { user, isAdmin, isModerator } = useAuth();
  const canReview = isAdmin || isModerator;

  const { data: upcomingQuotes = [], isLoading: quotesLoading } = useQuery({
    queryKey: ['today-work-upcoming-quotes', user?.id, canReview],
    queryFn: async () => {
      let query = supabase
        .from('saved_quotes')
        .select('id, quote_number, project_name, recipient_company, desired_delivery_date, project_stage, user_id')
        .gte('desired_delivery_date', todayString())
        .lte('desired_delivery_date', plusDaysString(7))
        .not('project_stage', 'eq', 'completed')
        .not('project_stage', 'eq', 'cancelled')
        .order('desired_delivery_date', { ascending: true })
        .limit(8);

      if (!canReview && user?.id) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as UpcomingQuote[];
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  const { data: activeProjects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['today-work-active-projects', user?.id, canReview],
    queryFn: async () => {
      let query = supabase
        .from('projects')
        .select('id, name, status, updated_at, user_id')
        .not('status', 'eq', 'completed')
        .not('status', 'eq', 'cancelled')
        .order('updated_at', { ascending: false })
        .limit(5);

      if (!canReview && user?.id) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ActiveProject[];
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  const { data: pendingLeaves = [], isLoading: leavesLoading } = useQuery({
    queryKey: ['today-work-pending-leaves', canReview],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('id, user_name, leave_type, start_date, end_date, days')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(6);
      if (error) throw error;
      return (data || []) as PendingLeaveRequest[];
    },
    enabled: !!user && canReview,
    staleTime: 60 * 1000,
  });

  const { data: syncSummary = { pending: 0, failed: 0 }, isLoading: syncLoading } = useQuery({
    queryKey: ['today-work-document-sync-summary', canReview],
    queryFn: async (): Promise<DocumentSyncSummary> => {
      const [pendingResult, failedResult] = await Promise.all([
        supabase.from('document_files' as any).select('id', { count: 'exact', head: true }).eq('sync_status', 'pending'),
        supabase.from('document_files' as any).select('id', { count: 'exact', head: true }).eq('sync_status', 'failed'),
      ]);

      if (pendingResult.error) throw pendingResult.error;
      if (failedResult.error) throw failedResult.error;

      return {
        pending: pendingResult.count || 0,
        failed: failedResult.count || 0,
      };
    },
    enabled: !!user && canReview,
    staleTime: 60 * 1000,
  });

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.is_read).slice(0, 4),
    [notifications],
  );

  const workItems = useMemo<WorkItem[]>(() => {
    const items: WorkItem[] = [];

    unreadNotifications.forEach((notification) => {
      items.push({
        id: notification.id,
        title: notification.title,
        description: notification.description,
        label: '새 알림',
        tone: notification.type === 'leave_request' || notification.type === 'password_reset' || notification.type === 'pending_approval' ? 'warning' : 'neutral',
        icon: <Bell className="h-4 w-4" />,
        actionLabel: '확인',
        onClick: () => navigate(getNotificationPath(notification)),
      });
    });

    if (canReview) {
      pendingLeaves.forEach((leave) => {
        items.push({
          id: `leave-${leave.id}`,
          title: `${leave.user_name} 연차 승인 대기`,
          description: `${leave.leave_type} · ${format(parseISO(leave.start_date), 'M/d', { locale: ko })}~${format(parseISO(leave.end_date), 'M/d', { locale: ko })} · ${leave.days}일`,
          label: '승인 필요',
          tone: 'warning',
          icon: <ClipboardCheck className="h-4 w-4" />,
          actionLabel: '승인',
          onClick: () => navigate('/leave-management'),
        });
      });

      if (syncSummary.failed > 0) {
        items.push({
          id: 'document-sync-failed',
          title: `파일 동기화 실패 ${syncSummary.failed}건`,
          description: 'Drive 또는 외부 저장소 동기화 실패 항목을 확인해야 합니다.',
          label: '실패',
          tone: 'danger',
          icon: <AlertTriangle className="h-4 w-4" />,
          actionLabel: '점검',
          onClick: () => navigate('/storage-status'),
        });
      } else if (syncSummary.pending > 0) {
        items.push({
          id: 'document-sync-pending',
          title: `파일 동기화 대기 ${syncSummary.pending}건`,
          description: '최근 업로드 파일의 Drive 동기화 상태를 확인할 수 있습니다.',
          label: '대기',
          tone: 'primary',
          icon: <HardDrive className="h-4 w-4" />,
          actionLabel: '보기',
          onClick: () => navigate('/storage-status'),
        });
      }
    }

    upcomingQuotes.forEach((quote) => {
      const due = formatDueLabel(quote.desired_delivery_date);
      items.push({
        id: `quote-${quote.id}`,
        title: quote.project_name || quote.recipient_company || `견적 ${quote.quote_number}`,
        description: `납기 희망일 · ${quote.desired_delivery_date ? format(parseISO(quote.desired_delivery_date), 'yyyy. M. d', { locale: ko }) : '미정'}`,
        label: due.label,
        tone: due.tone,
        icon: <CalendarClock className="h-4 w-4" />,
        actionLabel: '견적',
        onClick: () => navigate(`/saved-quotes/${quote.id}`),
      });
    });

    activeProjects.forEach((project) => {
      items.push({
        id: `project-${project.id}`,
        title: project.name,
        description: `프로젝트 상태 · ${project.status}`,
        label: '진행중',
        tone: 'neutral',
        icon: <FolderOpen className="h-4 w-4" />,
        actionLabel: '프로젝트',
        onClick: () => navigate(`/project-management?id=${project.id}`),
      });
    });

    return items.slice(0, 12);
  }, [activeProjects, canReview, navigate, pendingLeaves, syncSummary, unreadNotifications, upcomingQuotes]);

  const isLoading = quotesLoading || projectsLoading || leavesLoading || syncLoading;
  const urgentCount = workItems.filter((item) => item.tone === 'danger' || item.tone === 'warning').length;

  return (
    <Card className="w-full overflow-hidden border-primary/10 bg-background/85 shadow-sm backdrop-blur">
      <CardHeader className="pb-3">
        <BrandedCardHeader
          icon={CheckCircle2}
          title="오늘 처리할 일"
          subtitle="알림, 승인, 납기, 프로젝트 상태를 우선순위 기준으로 모았습니다."
          actions={
            <div className="flex flex-wrap justify-end gap-2">
            <Badge variant="secondary" className="rounded-full px-2.5 py-1">
              총 {workItems.length}건
            </Badge>
            {urgentCount > 0 && (
              <Badge className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300">
                우선 확인 {urgentCount}건
              </Badge>
            )}
            </div>
          }
        />
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex min-h-[160px] items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            업무 항목을 불러오는 중입니다.
          </div>
        ) : workItems.length === 0 ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 text-center">
            <CheckCircle2 className="mb-2 h-9 w-9 text-emerald-500" />
            <p className="text-sm font-medium">현재 바로 처리할 항목이 없습니다.</p>
            <p className="mt-1 text-xs text-muted-foreground">캘린더와 최근 활동은 아래 카드에서 계속 확인할 수 있습니다.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[360px] pr-3">
            <div className="space-y-2">
              {workItems.map((item, index) => (
                <React.Fragment key={item.id}>
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="group grid w-full grid-cols-[auto,1fr,auto] items-center gap-3 rounded-xl border bg-card/80 p-3 text-left transition-colors hover:bg-accent/40"
                  >
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-full border', toneClasses(item.tone))}>
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{item.title}</p>
                        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', toneClasses(item.tone))}>
                          {item.label}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                      <span className="hidden sm:inline">{item.actionLabel}</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </button>
                  {index < workItems.length - 1 && <Separator className="opacity-40" />}
                </React.Fragment>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => navigate('/announcements')}>
            <Bell className="h-3.5 w-3.5" />
            공지
          </Button>
          <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => navigate('/saved-quotes')}>
            <FileText className="h-3.5 w-3.5" />
            견적
          </Button>
          <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => navigate('/project-management')}>
            <FolderOpen className="h-3.5 w-3.5" />
            프로젝트
          </Button>
          <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => navigate('/leave-management')}>
            <ClipboardCheck className="h-3.5 w-3.5" />
            승인
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TodayWorkCard;
