import React, { useEffect, useMemo, useState } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarDays, CheckSquare2, ChevronRight, Loader2, NotebookPen, Plus, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import {
  useCalendarDiaryEntry,
  useCalendarEvents,
  useCalendarTasks,
  useCreateCalendarTask,
  useSaveCalendarDiaryEntry,
  useUpdateCalendarTask,
} from '@/hooks/useInternalCalendar';
import { cn } from '@/lib/utils';
import type { CalendarTask, InternalCalendarEvent } from '@/types/internalCalendar';

function overlapsDay(event: InternalCalendarEvent, day: Date) {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(startOfDay(day), 1).getTime();
  return new Date(event.starts_at).getTime() < dayEnd && new Date(event.ends_at).getTime() > dayStart;
}

function formatEventTime(event: InternalCalendarEvent) {
  if (event.all_day) return '종일';
  return `${format(new Date(event.starts_at), 'HH:mm')} - ${format(new Date(event.ends_at), 'HH:mm')}`;
}

const MyCalendarDiarySection: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [taskTitle, setTaskTitle] = useState('');
  const [diaryDraft, setDiaryDraft] = useState('');
  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const rangeStart = startOfDay(selectedDate).toISOString();
  const rangeEnd = addDays(startOfDay(selectedDate), 1).toISOString();
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
  const saveDiary = useSaveCalendarDiaryEntry();

  useEffect(() => {
    setDiaryDraft(diaryEntry?.content || '');
  }, [diaryEntry?.content, selectedDateKey]);

  const dayEvents = useMemo(() => {
    return events
      .filter((event) => overlapsDay(event, selectedDate))
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [events, selectedDate]);

  const dayTasks = useMemo(() => {
    return tasks
      .filter((task) => task.task_date === selectedDateKey && task.status !== 'archived')
      .sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed') || a.title.localeCompare(b.title));
  }, [selectedDateKey, tasks]);

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
        priority: 'normal',
      });
      setTaskTitle('');
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

  const handleSaveDiary = async () => {
    try {
      await saveDiary.mutateAsync({ diary_date: selectedDateKey, content: diaryDraft });
      toast.success('개인 다이어리를 저장했습니다.');
    } catch (error: any) {
      toast.error(error?.message || '다이어리 저장에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border">
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-primary" />
              일정·다이어리
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              내 일정, 할 일, 개인 메모를 날짜별로 관리합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={selectedDateKey}
              onChange={(event) => setSelectedDate(new Date(`${event.target.value}T00:00:00`))}
              className="h-9 w-[150px] rounded-full"
            />
            <Button variant="outline" className="h-9 rounded-full" onClick={() => navigate(`/calendar?date=${selectedDateKey}`)}>
              전체 캘린더
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>{format(selectedDate, 'M월 d일 EEEE 일정', { locale: ko })}</span>
              <Badge variant="outline" className="rounded-full">{dayEvents.length}건</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {eventsLoading ? (
              <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                일정을 불러오는 중입니다.
              </div>
            ) : dayEvents.length > 0 ? dayEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent/30"
                onClick={() => navigate(`/calendar?date=${selectedDateKey}&event=${event.series_event_id || event.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{event.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatEventTime(event)}
                      {event.location ? ` · ${event.location}` : ''}
                    </p>
                  </div>
                  {event.is_redacted && <Badge variant="secondary" className="shrink-0 rounded-full">제한</Badge>}
                </div>
              </button>
            )) : (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                이 날짜에 등록된 일정이 없습니다.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <CheckSquare2 className="h-4 w-4 text-primary" />
                  내 할 일
                </span>
                <Badge variant="outline" className="rounded-full">
                  {dayTasks.filter((task) => task.status !== 'completed').length}개 남음
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={taskTitle}
                  onChange={(event) => setTaskTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleCreateTask();
                  }}
                  placeholder="할 일 추가"
                  className="h-9 rounded-full"
                />
                <Button className="h-9 rounded-full" onClick={handleCreateTask} disabled={createTask.isPending}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {dayTasks.length > 0 ? dayTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => handleToggleTask(task)}
                    className="flex w-full items-center gap-2 rounded-lg border p-2 text-left transition-colors hover:bg-accent/30"
                  >
                    <span className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                      task.status === 'completed' && 'border-emerald-500 bg-emerald-500 text-white',
                    )}>
                      <CheckSquare2 className="h-3 w-3" />
                    </span>
                    <span className={cn('truncate text-sm font-medium', task.status === 'completed' && 'text-muted-foreground line-through')}>
                      {task.title}
                    </span>
                  </button>
                )) : (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">등록된 할 일이 없습니다.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <NotebookPen className="h-4 w-4 text-primary" />
                개인 메모
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={diaryDraft}
                onChange={(event) => setDiaryDraft(event.target.value)}
                placeholder="개인 일정 메모와 하루 기록을 남겨두세요."
                className="min-h-36"
              />
              <Button variant="outline" className="mt-3 w-full rounded-full" onClick={handleSaveDiary} disabled={saveDiary.isPending}>
                {saveDiary.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                다이어리 저장
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MyCalendarDiarySection;
