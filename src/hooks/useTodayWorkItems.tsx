import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameDay,
  parseISO,
  startOfDay,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  FolderOpen,
  GraduationCap,
  HardDrive,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { AppNotification } from '@/hooks/useNotifications';
import { useEmployeeHrTasks } from '@/hooks/useHrSelfService';
import { useCalendarEvents, useCalendarTasks } from '@/hooks/useInternalCalendar';
import type { CalendarViewScope } from '@/types/internalCalendar';

export type WorkItemTone = 'danger' | 'warning' | 'primary' | 'neutral' | 'success';
export type TodayWorkCategory = 'notification' | 'approval' | 'calendar' | 'hr' | 'quote' | 'project' | 'system';

export interface TodayWorkItem {
  id: string;
  category: TodayWorkCategory;
  title: string;
  description: string;
  label: string;
  tone: WorkItemTone;
  icon: React.ReactNode;
  actionLabel: string;
  onClick: () => void;
  disabled?: boolean;
  isToday?: boolean;
  priority: number;
  sortAt?: string | null;
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

interface PendingApprovalRequest {
  id: string;
  request_type: string;
  title: string;
  summary: string | null;
  amount: number | null;
  requested_by_name: string | null;
  related_project_id: string | null;
  created_at: string;
}

const todayString = () => format(new Date(), 'yyyy-MM-dd');
const plusDaysString = (days: number) => format(addDays(new Date(), days), 'yyyy-MM-dd');
const TODAY_WORK_DISMISS_PREFIX = 'acbank:today-work-hidden:';

export function getNotificationPath(notification: AppNotification): string {
  if (notification.type === 'project_mention' && notification.data?.projectId) {
    return `/project-management?id=${notification.data.projectId}`;
  }
  if ((notification.type === 'quote_update' || notification.type === 'quote_modified') && notification.data?.quoteId) {
    return `/saved-quotes/${notification.data.quoteId}`;
  }
  if (notification.type === 'channel_talk_quote_lead' && notification.data?.lead_id) {
    return `/channel-talk-leads?id=${notification.data.lead_id}`;
  }
  if (notification.type === 'client_consultation_lead' && notification.data?.leadId) {
    return `/channel-talk-leads?source=imweb&id=${notification.data.leadId}`;
  }
  if (notification.type === 'meeting_reservation' || notification.type === 'meeting_reservation_status') {
    return notification.data?.meetingReservationId ? `/meeting-reservations?id=${notification.data.meetingReservationId}` : '/meeting-reservations';
  }
  if (notification.type === 'contract_request' || notification.type === 'contract_signed' || notification.type === 'contract_rejected' || notification.type === 'contract_withdrawn') {
    return '/my-page?tab=contracts';
  }
  if (notification.type === 'attendance_correction_request') {
    return '/my-page?tab=attendance';
  }
  if (notification.type === 'approval_request' || notification.type === 'approval_approved' || notification.type === 'approval_rejected') {
    return notification.data?.projectId ? `/project-management?id=${notification.data.projectId}` : '/review-hub';
  }
  if (notification.type === 'leave_request' || notification.type === 'leave_approved' || notification.type === 'leave_rejected') {
    return '/my-page?tab=attendance';
  }
  if (notification.type === 'peer_feedback') return '/my-page';
  if (notification.type === 'performance_review_summary') return '/my-page?tab=business';
  if (notification.type === 'system' && notification.data?.eventId) {
    return `/meeting-reservations?event=${notification.data.eventId}`;
  }
  return '/';
}

export function formatDueLabel(dateString: string | null): { label: string; tone: WorkItemTone; isToday: boolean; priority: number } {
  if (!dateString) return { label: '마감 미정', tone: 'neutral', isToday: false, priority: 80 };

  const target = parseISO(dateString);
  const diff = differenceInCalendarDays(target, new Date());

  if (diff < 0) return { label: `${Math.abs(diff)}일 지연`, tone: 'danger', isToday: false, priority: 5 };
  if (diff === 0) return { label: '오늘 마감', tone: 'danger', isToday: true, priority: 10 };
  if (diff <= 2) return { label: `${diff}일 남음`, tone: 'warning', isToday: false, priority: 30 };
  return { label: format(target, 'M월 d일', { locale: ko }), tone: 'primary', isToday: false, priority: 60 };
}

function formatEventTime(startsAt: string, allDay: boolean) {
  if (allDay) return '시간 미지정';
  return format(new Date(startsAt), 'HH:mm', { locale: ko });
}

function getDismissStorageKey(userId?: string | null) {
  return userId ? `${TODAY_WORK_DISMISS_PREFIX}${userId}:${todayString()}` : null;
}

function readDismissedIds(userId?: string | null) {
  const key = getDismissStorageKey(userId);
  if (!key || typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeDismissedIds(userId: string, ids: string[]) {
  const key = getDismissStorageKey(userId);
  if (!key || typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(ids));
}

function buildBriefing(items: TodayWorkItem[], urgentCount: number, todayCount: number) {
  if (items.length === 0) return '지금은 바로 처리할 항목이 없습니다. 필요한 기능은 바로가기에서 시작하세요.';

  const segments: string[] = [];
  if (urgentCount > 0) segments.push(`우선 확인 ${urgentCount}건`);
  if (todayCount > 0) segments.push(`오늘 일정/마감 ${todayCount}건`);

  const quoteCount = items.filter((item) => item.category === 'quote').length;
  const approvalCount = items.filter((item) => item.category === 'approval').length;
  if (approvalCount > 0) segments.push(`승인 ${approvalCount}건`);
  if (quoteCount > 0) segments.push(`납기 ${quoteCount}건`);

  const summary = segments.length > 0 ? segments.join(', ') : `업무 ${items.length}건`;
  return `${summary}을 확인하면 됩니다.`;
}

export function toneClasses(tone: WorkItemTone): string {
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

export function useTodayWorkItems(notifications: AppNotification[] = []) {
  const navigate = useNavigate();
  const { user, isAdmin, isModerator } = useAuth();
  const canReview = isAdmin || isModerator;
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => readDismissedIds(user?.id));
  const calendarScope: CalendarViewScope = canReview ? 'all' : 'my';
  const today = startOfDay(new Date());
  const calendarRangeStart = today.toISOString();
  const calendarRangeEnd = addDays(today, 8).toISOString();

  useEffect(() => {
    setDismissedIds(readDismissedIds(user?.id));
  }, [user?.id]);

  const dismissItem = useCallback((itemId: string) => {
    if (!user?.id) return;

    setDismissedIds((current) => {
      if (current.includes(itemId)) return current;
      const next = [...current, itemId];
      writeDismissedIds(user.id, next);
      return next;
    });
  }, [user?.id]);

  const resetDismissedItems = useCallback(() => {
    if (!user?.id) return;

    setDismissedIds([]);
    writeDismissedIds(user.id, []);
  }, [user?.id]);

  const { data: upcomingQuotes = [], isLoading: quotesLoading } = useQuery({
    queryKey: ['today-work-upcoming-quotes', user?.id, canReview],
    queryFn: async () => {
      let query = supabase
        .from('saved_quotes')
        .select('id, quote_number, project_name, recipient_company, desired_delivery_date, project_stage, user_id')
        .gte('desired_delivery_date', todayString())
        .lte('desired_delivery_date', plusDaysString(7))
        .not('project_stage', 'eq', 'delivered')
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

  const { data: pendingApprovalRequests = [], isLoading: approvalsLoading } = useQuery({
    queryKey: ['today-work-pending-approval-requests', canReview],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('approval_requests')
        .select('id, request_type, title, summary, amount, requested_by_name, related_project_id, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(6);
      if (error) throw error;
      return (data || []) as PendingApprovalRequest[];
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

  const { data: calendarEvents = [], isLoading: calendarLoading } = useCalendarEvents({
    rangeStart: calendarRangeStart,
    rangeEnd: calendarRangeEnd,
    scope: calendarScope,
    enabled: !!user,
  });
  const { data: calendarTasks = [], isLoading: calendarTasksLoading } = useCalendarTasks({
    rangeStart: calendarRangeStart,
    rangeEnd: calendarRangeEnd,
    enabled: !!user,
  });
  const { data: hrTasks = [], isLoading: hrTasksLoading } = useEmployeeHrTasks();

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.is_read).slice(0, 4),
    [notifications],
  );

  const workItems = useMemo<TodayWorkItem[]>(() => {
    const items: TodayWorkItem[] = [];

    unreadNotifications.forEach((notification) => {
      const urgent = notification.type === 'leave_request' || notification.type === 'attendance_correction_request' || notification.type === 'password_reset' || notification.type === 'pending_approval';
      items.push({
        id: notification.id,
        category: 'notification',
        title: notification.title,
        description: notification.description,
        label: '새 알림',
        tone: urgent ? 'warning' : 'neutral',
        icon: <Bell className="h-4 w-4" />,
        actionLabel: '확인',
        onClick: () => navigate(getNotificationPath(notification)),
        priority: urgent ? 15 : 45,
        sortAt: notification.created_at,
      });
    });

    if (canReview) {
      pendingLeaves.forEach((leave) => {
        items.push({
          id: `leave-${leave.id}`,
          category: 'approval',
          title: `${leave.user_name} 연차 승인 대기`,
          description: `${leave.leave_type} · ${format(parseISO(leave.start_date), 'M/d', { locale: ko })}~${format(parseISO(leave.end_date), 'M/d', { locale: ko })} · ${leave.days}일`,
          label: '승인 필요',
          tone: 'warning',
          icon: <ClipboardCheck className="h-4 w-4" />,
          actionLabel: '승인',
          onClick: () => navigate('/review-hub'),
          priority: 12,
          sortAt: leave.start_date,
        });
      });

      pendingApprovalRequests.forEach((request) => {
        items.push({
          id: `approval-request-${request.id}`,
          category: 'approval',
          title: request.title,
          description: `${request.requested_by_name || '요청자 미지정'} · ${request.amount != null ? `₩${Math.round(request.amount).toLocaleString()}` : '금액 미지정'}`,
          label: '품의 승인',
          tone: 'warning',
          icon: <ShieldCheck className="h-4 w-4" />,
          actionLabel: '승인',
          onClick: () => navigate(request.related_project_id ? `/project-management?id=${request.related_project_id}` : '/review-hub'),
          priority: 11,
          sortAt: request.created_at,
        });
      });

      if (syncSummary.failed > 0) {
        items.push({
          id: 'document-sync-failed',
          category: 'system',
          title: `파일 동기화 실패 ${syncSummary.failed}건`,
          description: 'Drive 또는 외부 저장소 동기화 실패 항목을 확인해야 합니다.',
          label: '실패',
          tone: 'danger',
          icon: <AlertTriangle className="h-4 w-4" />,
          actionLabel: '점검',
          onClick: () => navigate('/storage-status'),
          priority: 8,
        });
      } else if (syncSummary.pending > 0) {
        items.push({
          id: 'document-sync-pending',
          category: 'system',
          title: `파일 동기화 대기 ${syncSummary.pending}건`,
          description: '최근 업로드 파일의 Drive 동기화 상태를 확인할 수 있습니다.',
          label: '대기',
          tone: 'primary',
          icon: <HardDrive className="h-4 w-4" />,
          actionLabel: '보기',
          onClick: () => navigate('/storage-status'),
          priority: 50,
        });
      }
    }

    calendarEvents
      .filter((event) => event.status !== 'canceled')
      .slice(0, 8)
      .forEach((event) => {
        const startsAt = new Date(event.starts_at);
        const isTodayEvent = isSameDay(startsAt, new Date());
        const minutesUntilStart = Math.round((startsAt.getTime() - Date.now()) / 60000);
        const isReminderDue = event.reminder_minutes.some((minutes) => minutesUntilStart >= 0 && minutesUntilStart <= minutes);
        items.push({
          id: `calendar-${event.id}`,
          category: 'calendar',
          title: event.title,
          description: `${format(startsAt, 'M월 d일', { locale: ko })} · ${formatEventTime(event.starts_at, event.all_day)}${event.location ? ` · ${event.location}` : ''}`,
          label: isReminderDue ? '일정 알림' : isTodayEvent ? '오늘 일정' : '예정',
          tone: isReminderDue ? 'warning' : isTodayEvent ? 'primary' : 'neutral',
          icon: <CalendarClock className="h-4 w-4" />,
          actionLabel: '일정',
          onClick: () => navigate(event.source_path || `/calendar?date=${format(startsAt, 'yyyy-MM-dd')}&event=${event.id}`),
          isToday: isTodayEvent,
          priority: isReminderDue ? 16 : isTodayEvent ? 20 : 55,
          sortAt: event.starts_at,
        });
      });

    calendarTasks
      .filter((task) => task.status === 'open')
      .slice(0, 8)
      .forEach((task) => {
        const due = formatDueLabel(task.task_date);
        items.push({
          id: `calendar-task-${task.id}`,
          category: 'calendar',
          title: task.title,
          description: task.description || `${format(parseISO(task.task_date), 'M월 d일', { locale: ko })} 개인 할 일`,
          label: due.isToday ? '오늘 할 일' : due.label,
          tone: task.priority === 'high' ? 'warning' : due.tone,
          icon: <CheckCircle2 className="h-4 w-4" />,
          actionLabel: '할 일',
          onClick: () => navigate(`/calendar?date=${task.task_date}`),
          isToday: due.isToday,
          priority: task.priority === 'high' ? Math.min(due.priority, 18) : Math.min(due.priority + 5, 65),
          sortAt: task.task_date,
        });
      });

    hrTasks
      .filter((task) => task.status !== 'completed' && task.status !== 'cancelled')
      .slice(0, 5)
      .forEach((task) => {
        const due = formatDueLabel(task.due_date);
        const linkedPath = typeof task.linked_resource?.path === 'string' ? task.linked_resource.path : '/my-page?tab=tasks';
        items.push({
          id: `hr-task-${task.id}`,
          category: 'hr',
          title: task.title,
          description: task.description || '내 HR 업무를 확인해야 합니다.',
          label: due.label === '마감 미정' ? 'HR 업무' : due.label,
          tone: due.tone,
          icon: <GraduationCap className="h-4 w-4" />,
          actionLabel: '업무',
          onClick: () => navigate(linkedPath),
          isToday: due.isToday,
          priority: Math.min(due.priority, 35),
          sortAt: task.due_date,
        });
      });

    upcomingQuotes.forEach((quote) => {
      const due = formatDueLabel(quote.desired_delivery_date);
      items.push({
        id: `quote-${quote.id}`,
        category: 'quote',
        title: quote.project_name || quote.recipient_company || `견적 ${quote.quote_number}`,
        description: `납기 희망일 · ${quote.desired_delivery_date ? format(parseISO(quote.desired_delivery_date), 'yyyy. M. d', { locale: ko }) : '미정'}`,
        label: due.label.replace('마감', '납기'),
        tone: due.tone,
        icon: <FileText className="h-4 w-4" />,
        actionLabel: '견적',
        onClick: () => navigate(`/saved-quotes/${quote.id}`),
        isToday: due.isToday,
        priority: due.priority + 5,
        sortAt: quote.desired_delivery_date,
      });
    });

    activeProjects.forEach((project) => {
      items.push({
        id: `project-${project.id}`,
        category: 'project',
        title: project.name,
        description: `프로젝트 상태 · ${project.status}`,
        label: '진행중',
        tone: 'neutral',
        icon: <FolderOpen className="h-4 w-4" />,
        actionLabel: '프로젝트',
        onClick: () => navigate(`/project-management?id=${project.id}`),
        priority: 85,
        sortAt: project.updated_at,
      });
    });

    return items
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (!a.sortAt && !b.sortAt) return 0;
        if (!a.sortAt) return 1;
        if (!b.sortAt) return -1;
        return new Date(a.sortAt).getTime() - new Date(b.sortAt).getTime();
      })
      .slice(0, 12);
  }, [activeProjects, calendarEvents, calendarTasks, canReview, hrTasks, navigate, pendingApprovalRequests, pendingLeaves, syncSummary, unreadNotifications, upcomingQuotes]);

  const visibleWorkItems = useMemo(
    () => workItems.filter((item) => !dismissedIds.includes(item.id)),
    [dismissedIds, workItems],
  );
  const categoryCounts = useMemo(() => {
    return visibleWorkItems.reduce<Record<TodayWorkCategory, number>>((acc, item) => {
      acc[item.category] += 1;
      return acc;
    }, {
      notification: 0,
      approval: 0,
      calendar: 0,
      hr: 0,
      quote: 0,
      project: 0,
      system: 0,
    });
  }, [visibleWorkItems]);
  const urgentCount = visibleWorkItems.filter((item) => item.tone === 'danger' || item.tone === 'warning').length;
  const todayCount = visibleWorkItems.filter((item) => item.isToday).length;
  const briefing = buildBriefing(visibleWorkItems, urgentCount, todayCount);

  return {
    items: visibleWorkItems,
    allItemCount: workItems.length,
    hiddenCount: workItems.length - visibleWorkItems.length,
    categoryCounts,
    urgentCount,
    todayCount,
    briefing,
    dismissItem,
    resetDismissedItems,
    isLoading: quotesLoading || projectsLoading || leavesLoading || approvalsLoading || syncLoading || calendarLoading || calendarTasksLoading || hrTasksLoading,
  };
}
