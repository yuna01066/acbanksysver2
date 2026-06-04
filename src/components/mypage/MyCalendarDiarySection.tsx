import React, { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  CalendarDays,
  CalendarPlus,
  CheckSquare2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  NotebookPen,
  Plus,
  Repeat2,
  Save,
  Trash2,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import CalendarEventDeleteActions from '@/components/calendar/CalendarEventDeleteActions';
import CalendarEventDialog from '@/components/calendar/CalendarEventDialog';
import { useAuth } from '@/contexts/AuthContext';
import {
  useCalendarDiaryEntry,
  useCalendarEvents,
  useCalendarTasks,
  useCreateCalendarTask,
  useDeleteCalendarTask,
  useSaveCalendarDiaryEntry,
  useUpdateCalendarTask,
} from '@/hooks/useInternalCalendar';
import { cn } from '@/lib/utils';
import type { CalendarTask, CalendarTaskPriority, InternalCalendarEvent } from '@/types/internalCalendar';
import { MyPageEmptyState, MyPageMetricCard, MyPageSectionHeader } from '@/components/mypage/MyPageLayout';

type PersonalScheduleView = 'day' | 'week' | 'month';

const VIEW_OPTIONS: Array<{ value: PersonalScheduleView; label: string }> = [
  { value: 'day', label: '시간별' },
  { value: 'week', label: '주간' },
  { value: 'month', label: '월간' },
];

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 22;
const HOUR_SLOTS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, index) => DAY_START_HOUR + index);
const TASK_PRIORITY_LABELS: Record<CalendarTaskPriority, string> = {
  low: '낮음',
  normal: '보통',
  high: '중요',
};

function parseDateParam(value: string | null) {
  if (!value) return new Date();
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normalizeViewParam(value: string | null): PersonalScheduleView {
  return value === 'week' || value === 'month' ? value : 'day';
}

function overlapsDay(event: InternalCalendarEvent, day: Date) {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(startOfDay(day), 1).getTime();
  return new Date(event.starts_at).getTime() < dayEnd && new Date(event.ends_at).getTime() > dayStart;
}

function formatEventTime(event: InternalCalendarEvent) {
  if (event.all_day) return '종일';
  return `${format(new Date(event.starts_at), 'HH:mm')} - ${format(new Date(event.ends_at), 'HH:mm')}`;
}

function getEventStartTime(event: InternalCalendarEvent) {
  return event.all_day ? '종일' : format(new Date(event.starts_at), 'HH:mm');
}

function isPersonalEvent(event: InternalCalendarEvent, userId?: string) {
  if (!userId) return false;
  return event.created_by === userId
    && event.source_type === 'manual'
    && (event.source_subtype === 'personal' || event.metadata?.calendar_kind === 'personal');
}

function getRangeDays(view: PersonalScheduleView, selectedDate: Date) {
  if (view === 'day') return [startOfDay(selectedDate)];
  if (view === 'week') {
    return eachDayOfInterval({
      start: startOfWeek(selectedDate, { weekStartsOn: 0 }),
      end: endOfWeek(selectedDate, { weekStartsOn: 0 }),
    });
  }
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 0 }),
  });
}

function sortEvents(events: InternalCalendarEvent[]) {
  return [...events].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
}

function getTaskSortValue(task: CalendarTask) {
  const priorityOrder: Record<CalendarTaskPriority, number> = { high: 0, normal: 1, low: 2 };
  return `${Number(task.status === 'completed')}-${priorityOrder[task.priority]}-${task.created_at}`;
}

function getTimelineStyle(event: InternalCalendarEvent) {
  const rangeMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;
  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const clampedStart = Math.max(DAY_START_HOUR * 60, Math.min(DAY_END_HOUR * 60, startMinutes));
  const clampedEnd = Math.max(clampedStart + 30, Math.min(DAY_END_HOUR * 60, endMinutes));
  return {
    top: `${((clampedStart - DAY_START_HOUR * 60) / rangeMinutes) * 100}%`,
    height: `${Math.max(40, ((clampedEnd - clampedStart) / rangeMinutes) * (HOUR_SLOTS.length * 72))}px`,
  };
}

const MyCalendarDiarySection: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDate = parseDateParam(searchParams.get('date'));
  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const viewMode = normalizeViewParam(searchParams.get('view'));
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<CalendarTaskPriority>('normal');
  const [diaryDraft, setDiaryDraft] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDate, setDialogDate] = useState(selectedDate);
  const [dialogStartTime, setDialogStartTime] = useState<string | undefined>();
  const [editingEvent, setEditingEvent] = useState<InternalCalendarEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<InternalCalendarEvent | null>(null);

  const rangeDays = useMemo(() => getRangeDays(viewMode, selectedDate), [selectedDate, viewMode]);
  const rangeStart = startOfDay(rangeDays[0] || selectedDate).toISOString();
  const rangeEnd = addDays(startOfDay(rangeDays[rangeDays.length - 1] || selectedDate), 1).toISOString();

  const { data: events = [], isLoading: eventsLoading } = useCalendarEvents({
    rangeStart,
    rangeEnd,
    scope: 'my',
    enabled: !!user,
  });
  const { data: tasks = [] } = useCalendarTasks({ rangeStart, rangeEnd, enabled: !!user });
  const { data: diaryEntry } = useCalendarDiaryEntry(selectedDateKey, !!user);
  const createTask = useCreateCalendarTask();
  const updateTask = useUpdateCalendarTask();
  const deleteTask = useDeleteCalendarTask();
  const saveDiary = useSaveCalendarDiaryEntry();

  useEffect(() => {
    setDiaryDraft(diaryEntry?.content || '');
  }, [diaryEntry?.content, selectedDateKey]);

  const personalEvents = useMemo(() => {
    return sortEvents(events.filter((event) => isPersonalEvent(event, user?.id)));
  }, [events, user?.id]);

  const selectedDateEvents = useMemo(() => {
    return personalEvents.filter((event) => overlapsDay(event, selectedDate));
  }, [personalEvents, selectedDate]);

  const selectedDateTasks = useMemo(() => {
    return tasks
      .filter((task) => task.task_date === selectedDateKey && task.status !== 'archived')
      .sort((a, b) => getTaskSortValue(a).localeCompare(getTaskSortValue(b)));
  }, [selectedDateKey, tasks]);

  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const todayEvents = personalEvents.filter((event) => overlapsDay(event, new Date()));
  const todayTasks = tasks.filter((task) => task.task_date === todayKey && task.status !== 'archived');
  const nextEvent = personalEvents.find((event) => event.status !== 'canceled' && new Date(event.ends_at).getTime() >= Date.now());

  const updateScheduleParams = (updates: { date?: Date; view?: PersonalScheduleView }) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', 'schedule');
    if (updates.date) nextParams.set('date', format(updates.date, 'yyyy-MM-dd'));
    if (updates.view) nextParams.set('view', updates.view);
    setSearchParams(nextParams);
  };

  const moveDate = (direction: -1 | 1) => {
    const nextDate = viewMode === 'month'
      ? (direction > 0 ? addMonths(selectedDate, 1) : subMonths(selectedDate, 1))
      : addDays(selectedDate, direction * (viewMode === 'week' ? 7 : 1));
    updateScheduleParams({ date: nextDate });
  };

  const openNewEvent = (date = selectedDate, startTime?: string) => {
    setEditingEvent(null);
    setDialogDate(date);
    setDialogStartTime(startTime);
    setDialogOpen(true);
  };

  const openEditEvent = (event: InternalCalendarEvent) => {
    setEditingEvent(event.series_event_id ? {
      ...event,
      id: event.series_event_id,
      starts_at: event.series_starts_at || event.starts_at,
      ends_at: event.series_ends_at || event.ends_at,
      is_recurring_occurrence: false,
    } : event);
    setDialogDate(new Date(event.starts_at));
    setDialogStartTime(undefined);
    setDialogOpen(true);
  };

  const handleCreateTask = async () => {
    const title = taskTitle.trim();
    if (!title) {
      toast.error('할 일 제목을 입력해주세요.');
      return;
    }
    try {
      await createTask.mutateAsync({
        title,
        task_date: selectedDateKey,
        priority: taskPriority,
      });
      setTaskTitle('');
      setTaskPriority('normal');
      toast.success('할 일을 추가했습니다.');
    } catch (error: any) {
      toast.error(error?.message || '할 일 추가에 실패했습니다.');
    }
  };

  const handleToggleTask = async (task: CalendarTask) => {
    try {
      await updateTask.mutateAsync({
        id: task.id,
        title: task.title,
        description: task.description,
        task_date: task.task_date,
        priority: task.priority,
        status: task.status === 'completed' ? 'open' : 'completed',
        linked_event_id: task.linked_event_id,
      });
    } catch (error: any) {
      toast.error(error?.message || '할 일 변경에 실패했습니다.');
    }
  };

  const handleUpdateTaskPriority = async (task: CalendarTask, priority: CalendarTaskPriority) => {
    try {
      await updateTask.mutateAsync({
        id: task.id,
        title: task.title,
        description: task.description,
        task_date: task.task_date,
        priority,
        status: task.status,
        linked_event_id: task.linked_event_id,
      });
    } catch (error: any) {
      toast.error(error?.message || '우선순위 변경에 실패했습니다.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask.mutateAsync(taskId);
      toast.success('할 일을 삭제했습니다.');
    } catch (error: any) {
      toast.error(error?.message || '할 일 삭제에 실패했습니다.');
    }
  };

  const handleSaveDiary = async () => {
    try {
      await saveDiary.mutateAsync({ diary_date: selectedDateKey, content: diaryDraft });
      toast.success('개인 다이어리를 저장했습니다.');
    } catch (error: any) {
      toast.error(error?.message || '다이어리 저장에 실패했습니다.');
    }
  };

  const renderEventPill = (event: InternalCalendarEvent, compact = false) => (
    <button
      key={event.id}
      type="button"
      className={cn(
        'w-full rounded-lg border border-border bg-background p-2 text-left transition-colors hover:bg-muted/50',
        selectedEvent?.id === event.id && 'border-foreground',
      )}
      onClick={() => {
        setSelectedEvent(event);
        updateScheduleParams({ date: new Date(event.starts_at) });
      }}
      title={event.title}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn('truncate font-semibold', compact ? 'text-xs' : 'text-sm')}>{event.title}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {formatEventTime(event)}
            {event.location ? ` · ${event.location}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {event.recurrence_rule && <Repeat2 className="h-3 w-3 text-muted-foreground" />}
          {event.reminder_minutes.length > 0 && <Clock3 className="h-3 w-3 text-muted-foreground" />}
        </div>
      </div>
    </button>
  );

  const renderDayView = () => {
    const allDayEvents = selectedDateEvents.filter((event) => event.all_day);
    const timedEvents = selectedDateEvents.filter((event) => !event.all_day);

    return (
      <Card className="border shadow-none">
        <CardHeader className="border-b pb-3">
          <CardTitle className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span>{format(selectedDate, 'M월 d일 EEEE 개인 스케줄', { locale: ko })}</span>
            <Badge variant="outline" className="w-fit rounded-full">{selectedDateEvents.length}개 일정</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {allDayEvents.length > 0 && (
            <div className="mb-4 space-y-2 rounded-lg border bg-muted/20 p-3">
              <p className="text-xs font-semibold text-muted-foreground">종일 일정</p>
              {allDayEvents.map((event) => renderEventPill(event))}
            </div>
          )}
          <div className="relative grid grid-cols-[64px_minmax(0,1fr)]">
            <div>
              {HOUR_SLOTS.map((hour) => (
                <div key={hour} className="h-[72px] border-r pr-3 text-right text-xs font-medium text-muted-foreground">
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>
            <div className="relative min-h-[1008px]">
              {HOUR_SLOTS.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  className="block h-[72px] w-full border-b border-dashed border-border text-left transition-colors hover:bg-muted/30"
                  onClick={() => openNewEvent(selectedDate, `${String(hour).padStart(2, '0')}:00`)}
                  aria-label={`${hour}시 개인 일정 추가`}
                />
              ))}
              {timedEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className="absolute left-3 right-3 overflow-hidden rounded-lg border border-foreground/10 bg-foreground px-3 py-2 text-left text-background shadow-sm transition-transform hover:-translate-y-0.5"
                  style={getTimelineStyle(event)}
                  onClick={() => setSelectedEvent(event)}
                >
                  <p className="truncate text-sm font-semibold">{event.title}</p>
                  <p className="mt-0.5 text-xs text-background/70">{formatEventTime(event)}</p>
                </button>
              ))}
              {!eventsLoading && selectedDateEvents.length === 0 && (
                <div className="absolute inset-x-4 top-8 rounded-lg border border-dashed bg-background p-6 text-center text-sm text-muted-foreground">
                  빈 시간대를 클릭해 개인 일정을 등록하세요.
                </div>
              )}
              {eventsLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  일정을 불러오는 중입니다.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderWeekView = () => (
    <Card className="border shadow-none">
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-sm">
          {format(rangeDays[0], 'M월 d일', { locale: ko })} - {format(rangeDays[6], 'M월 d일 주간', { locale: ko })}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 p-4 md:grid-cols-7">
        {rangeDays.map((day) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayEvents = personalEvents.filter((event) => overlapsDay(event, day));
          const dayTasks = tasks.filter((task) => task.task_date === dayKey && task.status !== 'archived');
          return (
            <section
              key={dayKey}
              className={cn('min-h-[220px] rounded-lg border bg-background p-3', isSameDay(day, selectedDate) && 'border-foreground')}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left"
                onClick={() => updateScheduleParams({ date: day, view: 'day' })}
              >
                <span className={cn('text-sm font-semibold', isToday(day) && 'text-primary')}>
                  {format(day, 'EEE d', { locale: ko })}
                </span>
                <Badge variant="outline" className="rounded-full text-[10px]">{dayEvents.length + dayTasks.length}</Badge>
              </button>
              <div className="mt-3 space-y-1.5">
                {dayEvents.slice(0, 3).map((event) => renderEventPill(event, true))}
                {dayTasks.slice(0, 2).map((task) => (
                  <div key={task.id} className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1.5 text-xs">
                    <CheckSquare2 className="h-3 w-3 text-muted-foreground" />
                    <span className={cn('truncate', task.status === 'completed' && 'text-muted-foreground line-through')}>{task.title}</span>
                  </div>
                ))}
                {dayEvents.length + dayTasks.length === 0 && (
                  <button
                    type="button"
                    className="w-full rounded-md border border-dashed p-3 text-left text-xs text-muted-foreground hover:bg-muted/30"
                    onClick={() => openNewEvent(day)}
                  >
                    일정 추가
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );

  const renderMonthView = () => (
    <Card className="border shadow-none">
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-sm">{format(selectedDate, 'yyyy년 M월 개인 스케줄', { locale: ko })}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-b bg-muted/20 text-center text-xs font-semibold text-muted-foreground">
          {WEEKDAY_LABELS.map((weekday) => (
            <div key={weekday} className="py-2">{weekday}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {rangeDays.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayEvents = personalEvents.filter((event) => overlapsDay(event, day));
            const dayTasks = tasks.filter((task) => task.task_date === dayKey && task.status !== 'archived');
            return (
              <button
                key={dayKey}
                type="button"
                className={cn(
                  'min-h-[118px] border-b border-r p-2 text-left transition-colors hover:bg-muted/30',
                  !isSameMonth(day, selectedDate) && 'bg-muted/20 text-muted-foreground',
                  isSameDay(day, selectedDate) && 'bg-foreground/[0.03]',
                )}
                onClick={() => updateScheduleParams({ date: day, view: 'day' })}
              >
                <span className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                  isToday(day) && 'bg-foreground text-background',
                )}>
                  {format(day, 'd')}
                </span>
                <div className="mt-2 space-y-1">
                  {dayEvents.slice(0, 2).map((event) => (
                    <div key={event.id} className="truncate rounded bg-foreground px-1.5 py-1 text-[10px] font-medium text-background">
                      {getEventStartTime(event)} {event.title}
                    </div>
                  ))}
                  {dayTasks.length > 0 && (
                    <div className="truncate rounded bg-muted px-1.5 py-1 text-[10px] font-medium text-muted-foreground">
                      할 일 {dayTasks.length}개
                    </div>
                  )}
                  {dayEvents.length > 2 && <p className="text-[10px] font-semibold text-muted-foreground">+{dayEvents.length - 2}개 더보기</p>}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <MyPageSectionHeader
        title="개인 스케줄러"
        description="통합 캘린더와 분리된 개인 일정, 할 일, 다이어리를 관리합니다. 상세 내용은 본인만 확인할 수 있습니다."
        icon={<CalendarDays className="h-4 w-4" />}
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="h-9 rounded-full" onClick={() => navigate(`/calendar?date=${selectedDateKey}&view=day`)}>
              통합 캘린더 보기
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
            <Button className="h-9 rounded-full bg-foreground text-background hover:bg-foreground/90" onClick={() => openNewEvent(selectedDate)}>
              <CalendarPlus className="mr-1.5 h-4 w-4" />
              개인 일정
            </Button>
          </div>
        )}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <MyPageMetricCard label="오늘 일정" value={`${todayEvents.length}건`} description="본인 비공개 일정 기준" icon={<CalendarDays className="h-4 w-4" />} />
        <MyPageMetricCard
          label="오늘 할 일"
          value={`${todayTasks.filter((task) => task.status !== 'completed').length}개`}
          description={`${todayTasks.filter((task) => task.status === 'completed').length}개 완료`}
          icon={<CheckSquare2 className="h-4 w-4" />}
          tone="primary"
        />
        <MyPageMetricCard
          label="다음 일정"
          value={nextEvent ? format(new Date(nextEvent.starts_at), 'M/d HH:mm') : '-'}
          description={nextEvent?.title || '예정된 개인 일정 없음'}
          icon={<Clock3 className="h-4 w-4" />}
        />
        <MyPageMetricCard
          label="선택 날짜"
          value={format(selectedDate, 'M월 d일', { locale: ko })}
          description={`${selectedDateEvents.length}개 일정 · ${selectedDateTasks.length}개 할 일`}
          icon={<NotebookPen className="h-4 w-4" />}
        />
      </div>

      <div className="rounded-xl border bg-background p-3 shadow-none">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => moveDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={selectedDateKey}
              onChange={(event) => updateScheduleParams({ date: new Date(`${event.target.value}T00:00:00`) })}
              className="h-9 w-[150px] rounded-full"
            />
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => moveDate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="h-9 rounded-full" onClick={() => updateScheduleParams({ date: new Date(), view: 'day' })}>
              오늘
            </Button>
          </div>
          <div className="flex w-full rounded-full border bg-muted/30 p-1 sm:w-auto">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateScheduleParams({ view: option.value })}
                className={cn(
                  'h-8 flex-1 rounded-full px-4 text-xs font-semibold transition-colors sm:flex-none',
                  viewMode === option.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          {viewMode === 'day' && renderDayView()}
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'month' && renderMonthView()}
        </div>

        <aside className="space-y-4">
          <Card className="border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm">
                <span>{format(selectedDate, 'M월 d일 할 일', { locale: ko })}</span>
                <Badge variant="outline" className="rounded-full">
                  {selectedDateTasks.filter((task) => task.status !== 'completed').length}개 남음
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-[minmax(0,1fr)_88px_auto] gap-2">
                <Input
                  value={taskTitle}
                  onChange={(event) => setTaskTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleCreateTask();
                  }}
                  placeholder="할 일 추가"
                  className="h-9 rounded-full"
                />
                <Select value={taskPriority} onValueChange={(value) => setTaskPriority(value as CalendarTaskPriority)}>
                  <SelectTrigger className="h-9 rounded-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="h-9 rounded-full" onClick={handleCreateTask} disabled={createTask.isPending}>
                  {createTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {selectedDateTasks.length > 0 ? selectedDateTasks.map((task) => (
                  <div key={task.id} className="grid grid-cols-[auto,minmax(0,1fr),88px,auto] items-center gap-2 rounded-lg border p-2">
                    <button
                      type="button"
                      onClick={() => handleToggleTask(task)}
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full border',
                        task.status === 'completed' && 'border-emerald-500 bg-emerald-500 text-white',
                      )}
                      aria-label={task.status === 'completed' ? '할 일 완료 해제' : '할 일 완료'}
                    >
                      <CheckSquare2 className="h-3.5 w-3.5" />
                    </button>
                    <span className={cn('truncate text-sm font-medium', task.status === 'completed' && 'text-muted-foreground line-through')}>
                      {task.title}
                    </span>
                    <Select value={task.priority} onValueChange={(value) => handleUpdateTaskPriority(task, value as CalendarTaskPriority)}>
                      <SelectTrigger className="h-8 rounded-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteTask(task.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )) : (
                  <MyPageEmptyState title="이 날짜에 등록된 할 일이 없습니다." />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <NotebookPen className="h-4 w-4 text-primary" />
                개인 다이어리
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={diaryDraft}
                onChange={(event) => setDiaryDraft(event.target.value)}
                placeholder="개인 일정 메모와 하루 기록을 남겨두세요."
                className="min-h-32"
              />
              <Button variant="outline" className="mt-3 w-full rounded-full" onClick={handleSaveDiary} disabled={saveDiary.isPending}>
                {saveDiary.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                다이어리 저장
              </Button>
            </CardContent>
          </Card>

          <Card className="border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">선택 일정</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedEvent ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold">{selectedEvent.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {format(new Date(selectedEvent.starts_at), 'M월 d일 EEE', { locale: ko })} {formatEventTime(selectedEvent)}
                    </p>
                  </div>
                  {selectedEvent.description && (
                    <p className="rounded-lg border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
                      {selectedEvent.description}
                    </p>
                  )}
                  <Button variant="outline" className="h-9 w-full rounded-full" onClick={() => openEditEvent(selectedEvent)}>
                    일정 수정
                  </Button>
                  <CalendarEventDeleteActions
                    event={selectedEvent.series_event_id ? { ...selectedEvent, id: selectedEvent.series_event_id } : selectedEvent}
                    onDeleted={() => {
                      setSelectedEvent(null);
                      setEditingEvent(null);
                    }}
                  />
                </div>
              ) : (
                <MyPageEmptyState title="일정을 선택하면 상세 정보가 표시됩니다." />
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      <CalendarEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editingEvent}
        events={personalEvents}
        defaultDate={format(dialogDate, 'yyyy-MM-dd')}
        defaultStartTime={dialogStartTime}
        defaultMode="personal"
        personalOnly
        onSaved={() => {
          setEditingEvent(null);
          setSelectedEvent(null);
        }}
      />
    </div>
  );
};

export default MyCalendarDiarySection;
