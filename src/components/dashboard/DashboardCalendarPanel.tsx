import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarCheck2, ChevronLeft, ChevronRight, Clock3, DoorOpen, ListChecks, Plus, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import CalendarEventDialog from '@/components/calendar/CalendarEventDialog';
import { BrandedCardHeader } from '@/components/ui/branded-card-header';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  getCalendarMonthRange,
  useCalendarDashboardSummary,
  useCalendarEvents,
} from '@/hooks/useInternalCalendar';
import {
  CALENDAR_EVENT_LEGEND,
  getCalendarEventAccent,
  getCalendarEventStatusLabel,
  isCompletedDeliveryCalendarEvent,
  shouldShowUnspecifiedCalendarTime,
  type CalendarViewScope,
  type InternalCalendarEvent,
} from '@/types/internalCalendar';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function formatEventTime(event: InternalCalendarEvent) {
  if (event.all_day) return shouldShowUnspecifiedCalendarTime(event) ? '시간 미지정' : '종일';
  return `${format(new Date(event.starts_at), 'HH:mm')} - ${format(new Date(event.ends_at), 'HH:mm')}`;
}

function eventOverlapsDay(event: InternalCalendarEvent, day: Date) {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(startOfDay(day), 1).getTime();
  return new Date(event.starts_at).getTime() < dayEnd && new Date(event.ends_at).getTime() > dayStart;
}

function getEventMeta(event: InternalCalendarEvent) {
  return event.location || event.resource_names.join(', ') || event.participant_names.join(', ') || event.created_by_name;
}

function isHolidayEvent(event: InternalCalendarEvent) {
  return event.source_type === 'holiday' || event.icon_type === 'holiday';
}

function getEventStatusBadgeClassName(event: InternalCalendarEvent) {
  if (isCompletedDeliveryCalendarEvent(event)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (event.source_type === 'quote' && event.source_subtype === 'delivery') {
    return 'border-orange-200 bg-orange-50 text-orange-700';
  }
  return '';
}

const DashboardCalendarPanel = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isModerator } = useAuth();
  const canViewAll = isAdmin || isModerator;
  const [scope, setScope] = useState<CalendarViewScope>(canViewAll ? 'all' : 'my');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'employee' | 'client' | 'room' | 'manual'>('employee');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const dashboardRange = useMemo(() => {
    const now = new Date();
    return {
      today: now,
      rangeStart: startOfDay(now).toISOString(),
      rangeEnd: addDays(now, 14).toISOString(),
    };
  }, []);
  const { rangeStart, rangeEnd } = getCalendarMonthRange(calendarMonth);

  const { data: calendarEvents = [] } = useCalendarEvents({
    rangeStart,
    rangeEnd,
    scope,
    enabled: !!user,
  });
  const { data: dashboardEvents = [] } = useCalendarEvents({
    rangeStart: dashboardRange.rangeStart,
    rangeEnd: dashboardRange.rangeEnd,
    scope,
    enabled: !!user,
  });
  const { data: summary } = useCalendarDashboardSummary({
    rangeStart: dashboardRange.rangeStart,
    rangeEnd: dashboardRange.rangeEnd,
    scope,
    enabled: !!user,
  });

  const days = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(calendarMonth)),
      end: endOfWeek(endOfMonth(calendarMonth)),
    });
  }, [calendarMonth]);

  const upcomingEvents = useMemo(() => {
    return dashboardEvents
      .filter((event) => new Date(event.ends_at).getTime() >= Date.now())
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
  }, [dashboardEvents]);

  const dialogEvents = useMemo(() => {
    return Array.from(new Map([...calendarEvents, ...dashboardEvents].map((event) => [event.id, event])).values());
  }, [calendarEvents, dashboardEvents]);

  const todayEvents = useMemo(() => {
    return dashboardEvents
      .filter((event) => eventOverlapsDay(event, dashboardRange.today))
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [dashboardEvents, dashboardRange.today]);
  const timelineEvents = todayEvents.length > 0 ? todayEvents : upcomingEvents.slice(0, 8);
  const timelineTitle = todayEvents.length > 0 ? '오늘 일정 타임라인' : '다가오는 일정';
  const nextEvent = summary?.next_event || upcomingEvents[0] || null;
  const rooms = summary?.rooms || [];
  const isViewingCurrentMonth = isSameMonth(calendarMonth, dashboardRange.today);

  const openDialog = (mode: 'employee' | 'client' | 'room' | 'manual', date = format(new Date(), 'yyyy-MM-dd')) => {
    setSelectedDate(date);
    setDialogMode(mode);
    setDialogOpen(true);
  };

  const openSourcePath = (event: InternalCalendarEvent, day: Date) => {
    const dayPath = `/calendar?date=${format(day, 'yyyy-MM-dd')}`;
    if (event.source_path) {
      if (/^https?:\/\//i.test(event.source_path)) {
        window.open(event.source_path, '_blank', 'noopener,noreferrer');
      } else {
        navigate(event.source_path);
      }
      return;
    }

    navigate(event.can_edit ? `/calendar?event=${event.id}` : `${dayPath}&event=${event.id}`);
  };

  return (
    <>
      <Card className="overflow-hidden rounded-lg border-border bg-card shadow-none">
        <CardHeader className="pb-2">
          <BrandedCardHeader
            icon={CalendarCheck2}
            title="통합 캘린더"
            subtitle="오늘 일정, 담당 미팅, 회의실 상태를 한 번에 확인합니다."
            iconWrapClassName="border-border bg-card text-foreground/70"
            actions={(
              <div className="flex flex-wrap items-center gap-2">
                {canViewAll && (
                  <div className="flex rounded-full border border-border bg-card p-1">
                    {[
                      { value: 'my', label: '내 일정' },
                      { value: 'all', label: '전체 일정' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setScope(option.value as CalendarViewScope)}
                        className={cn(
                          'h-7 rounded-full px-2.5 text-xs font-semibold transition-colors',
                          scope === option.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
                <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => navigate('/calendar')}>
                  전체보기
                </Button>
              </div>
            )}
          />
        </CardHeader>

        <CardContent className="space-y-4 px-4 pb-4 pt-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: scope === 'all' ? '오늘 전체 일정' : '오늘 내 일정', value: todayEvents.length, icon: CalendarCheck2, path: '/calendar?view=day' },
              { label: '다음 일정', value: nextEvent ? formatEventTime(nextEvent) : '-', icon: Clock3, path: '/calendar' },
              { label: '회의실 사용 중', value: summary?.rooms_in_use_count ?? 0, icon: DoorOpen, path: '/calendar' },
              { label: '담당 미팅', value: summary?.assigned_meeting_count ?? 0, icon: UsersRound, path: '/calendar' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className="rounded-lg border border-border bg-muted/25 p-3 text-left transition-colors hover:border-foreground/20 hover:bg-muted"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <p className="mt-2 text-xl font-bold leading-none text-foreground">{item.value}</p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">{item.label}</p>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex flex-col gap-2 border-b border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full border-border"
                    aria-label="이전 달"
                    onClick={() => setCalendarMonth((current) => subMonths(current, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <p className="min-w-[112px] text-center text-sm font-bold text-foreground">
                    {format(calendarMonth, 'yyyy년 M월', { locale: ko })}
                  </p>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full border-border"
                    aria-label="다음 달"
                    onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-full px-3 text-xs"
                    disabled={isViewingCurrentMonth}
                    onClick={() => setCalendarMonth(startOfMonth(new Date()))}
                  >
                    오늘
                  </Button>
                </div>
                <Button variant="outline" size="sm" className="h-8 rounded-full border-border text-xs" onClick={() => openDialog('employee')}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> 일정 추가
                </Button>
              </div>
              <div className="grid grid-cols-7 border-b border-border bg-muted/25 text-center text-[11px] font-semibold text-muted-foreground">
                {WEEKDAY_LABELS.map((weekday) => (
                  <div key={weekday} className="py-1.5">{weekday}</div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-2 text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">색상 기준</span>
                {CALENDAR_EVENT_LEGEND.map((item) => (
                  <span key={item.key} className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.accent }} />
                    {item.label}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {days.map((day, index) => {
                  const dayEvents = calendarEvents
                    .filter((event) => eventOverlapsDay(event, day))
                    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
                  const dotEvents = dayEvents.filter((event) => !isHolidayEvent(event));
                  const hasHoliday = dayEvents.some(isHolidayEvent);
                  const canSlidePopoverEvents = dayEvents.length > 4;
                  const dayKey = format(day, 'yyyy-MM-dd');
                  return (
                    <Popover key={day.toISOString()}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            'min-h-[70px] border-b border-border p-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-1',
                            (index + 1) % 7 !== 0 && 'border-r',
                            !isSameMonth(day, calendarMonth) && 'bg-muted/25 text-muted-foreground/60',
                            hasHoliday && 'bg-red-500/10 hover:bg-red-500/15',
                          )}
                        >
                          <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold', isToday(day) && 'bg-foreground text-background')}>
                            {format(day, 'd')}
                          </span>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {dotEvents.slice(0, 4).map((event) => (
                              <span
                                key={event.id}
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: getCalendarEventAccent(event) }}
                                title={event.title}
                              />
                            ))}
                            {dotEvents.length > 4 && (
                              <span className="text-[10px] font-semibold leading-none text-muted-foreground">
                                +{dotEvents.length - 4}
                              </span>
                            )}
                          </div>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        sideOffset={6}
                        className="w-[min(calc(100vw-2rem),360px)] rounded-lg border-border bg-card p-0 shadow-lg"
                      >
                        <div className="border-b border-border px-3 py-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-bold text-foreground">{format(day, 'M월 d일 EEEE', { locale: ko })}</p>
                            <Badge variant="outline" className="shrink-0 rounded-full px-2 py-0 text-[10px]">
                              {dayEvents.length}건
                            </Badge>
                          </div>
                        </div>
                        {dayEvents.length > 0 ? (
                          <div className="relative">
                            <ScrollArea
                              className={cn(
                                'pr-1',
                                canSlidePopoverEvents ? 'h-[min(46vh,336px)]' : 'max-h-[min(46vh,336px)]',
                              )}
                              aria-label={`${format(day, 'M월 d일', { locale: ko })} 일정 목록`}
                            >
                              <div className={cn('space-y-2 p-3 pr-4', canSlidePopoverEvents && 'pb-9')}>
                                {dayEvents.map((event) => {
                                    const accent = getCalendarEventAccent(event);
                                    const meta = getEventMeta(event);
                                    const completedDelivery = isCompletedDeliveryCalendarEvent(event);
                                    return (
                                      <button
                                        key={event.id}
                                        type="button"
                                        onClick={() => openSourcePath(event, day)}
                                        className={cn(
                                          'w-full snap-start rounded-lg border border-border bg-muted/25 p-2.5 text-left transition-colors hover:border-foreground/20 hover:bg-muted',
                                          completedDelivery && 'border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50',
                                        )}
                                      >
                                        <div className="flex items-start gap-2">
                                          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-2">
                                              <p className="min-w-0 truncate text-sm font-semibold text-foreground">{event.title}</p>
                                              <Badge variant="outline" className={cn('shrink-0 rounded-full px-2 py-0 text-[10px]', getEventStatusBadgeClassName(event))}>
                                                {getCalendarEventStatusLabel(event)}
                                              </Badge>
                                            </div>
                                            <p className="mt-1 text-xs font-medium text-muted-foreground">{formatEventTime(event)}</p>
                                            {meta && <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>}
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                              </div>
                            </ScrollArea>
                            {canSlidePopoverEvents && (
                              <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-lg border-t border-border bg-card/95 px-3 py-2">
                                <p className="text-center text-[11px] font-semibold text-muted-foreground">
                                  목록을 슬라이드해 {dayEvents.length}건 전체 보기
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-3">
                            <div className="rounded-lg border border-dashed border-border bg-muted/25 p-4 text-center">
                              <p className="text-sm font-semibold text-foreground">등록된 일정 없음</p>
                              <p className="mt-1 text-xs text-muted-foreground">이 날짜에 새 일정을 추가할 수 있습니다.</p>
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2 border-t border-border p-3">
                          <Button variant="outline" className="h-8 flex-1 rounded-full border-border text-xs" onClick={() => navigate(`/calendar?date=${dayKey}`)}>
                            전체 캘린더에서 보기
                          </Button>
                          <Button className="h-8 flex-1 rounded-full bg-foreground text-xs text-background hover:bg-foreground/85" onClick={() => openDialog('employee', dayKey)}>
                            일정 추가
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/25 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-foreground">{timelineTitle}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                      {todayEvents.length > 0 ? `${todayEvents.length}건 전체 표시` : '오늘 일정이 없어서 다음 일정을 표시합니다'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">
                      {timelineEvents.length}건
                    </Badge>
                    <ListChecks className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <ScrollArea className="mt-3 max-h-[360px] pr-2">
                  <div className="space-y-2 pr-1">
                    {timelineEvents.length > 0 ? timelineEvents.map((event) => (
                      (() => {
                        const accent = getCalendarEventAccent(event);
                        const completedDelivery = isCompletedDeliveryCalendarEvent(event);
                        const eventDay = new Date(event.starts_at);
                        return (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => navigate(`/calendar?date=${format(eventDay, 'yyyy-MM-dd')}&event=${event.id}`)}
                            className={cn(
                              'w-full rounded-lg border border-border bg-card p-2 text-left transition-colors hover:border-foreground/20 hover:bg-muted',
                              completedDelivery && 'border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50',
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
                                <p className="truncate text-sm font-semibold text-foreground">{event.title}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <Badge variant="outline" className={cn('rounded-full px-2 py-0 text-[10px]', getEventStatusBadgeClassName(event))}>
                                  {getCalendarEventStatusLabel(event)}
                                </Badge>
                                <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">
                                  {format(eventDay, 'M/d')}
                                </Badge>
                              </div>
                            </div>
                            <p className="mt-1 truncate text-xs text-muted-foreground">{formatEventTime(event)} · {event.location || event.resource_names.join(', ') || event.created_by_name}</p>
                          </button>
                        );
                      })()
                    )) : (
                      <p className="rounded-lg border border-dashed border-border bg-card p-3 text-sm text-muted-foreground">
                        예정된 일정이 없습니다.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-sm font-bold text-foreground">회의실 현황</p>
                <div className="mt-3 grid gap-2">
                  {rooms.map((room) => (
                    <div key={room.id} className="rounded-lg border border-border bg-muted/25 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{room.name}</p>
                        <Badge variant="outline" className={cn('rounded-full px-2 py-0 text-[10px]', room.current_event && 'border-foreground bg-foreground text-background')}>
                          {room.current_event ? '사용 중' : '비어 있음'}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {room.current_event
                          ? `${room.current_event.title} · ${format(new Date(room.current_event.ends_at), 'HH:mm')} 종료`
                          : room.next_event
                          ? `다음 ${format(new Date(room.next_event.starts_at), 'M/d HH:mm')} ${room.next_event.title}`
                          : '예정 예약 없음'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" className="h-9 rounded-full border-border text-xs" onClick={() => openDialog('employee')}>직원</Button>
                <Button variant="outline" className="h-9 rounded-full border-border text-xs" onClick={() => openDialog('client')}>고객</Button>
                <Button variant="outline" className="h-9 rounded-full border-border text-xs" onClick={() => openDialog('room')}>회의실</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <CalendarEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        events={dialogEvents}
        defaultDate={selectedDate}
        defaultMode={dialogMode}
      />
    </>
  );
};

export default DashboardCalendarPanel;
