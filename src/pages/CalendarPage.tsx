import { useEffect, useMemo, useState } from 'react';
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
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarCheck2,
  Cake,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  DoorOpen,
  FileText,
  FolderOpen,
  Gift,
  ListChecks,
  Loader2,
  MapPin,
  Palmtree,
  PartyPopper,
  Plus,
  Search,
  Truck,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import CalendarEventDialog from '@/components/calendar/CalendarEventDialog';
import CalendarEventDeleteActions from '@/components/calendar/CalendarEventDeleteActions';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  getCalendarMonthRange,
  useCalendarDirectory,
  useCalendarEvents,
  useCalendarResources,
  useCalendarSubscriptions,
} from '@/hooks/useInternalCalendar';
import {
  CALENDAR_EVENT_LEGEND,
  CALENDAR_SOURCE_FILTERS,
  CALENDAR_STATUS_LABELS,
  getCalendarEventAccent,
  getCalendarEventIconType,
  getCalendarSourceFilter,
  shouldShowUnspecifiedCalendarTime,
  type CalendarIconType,
  type CalendarResource,
  type CalendarSourceFilter,
  type CalendarSubscription,
  type CalendarViewScope,
  type InternalCalendarEvent,
} from '@/types/internalCalendar';

type CalendarViewMode = 'month' | 'week' | 'day';

const supabaseAny = supabase as any;
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const DEFAULT_SOURCE_FILTERS = CALENDAR_SOURCE_FILTERS.map((filter) => filter.value);
const CALENDAR_ICON_MAP: Record<CalendarIconType, LucideIcon> = {
  calendar: CalendarCheck2,
  quote: FileText,
  delivery: Truck,
  project: FolderOpen,
  meeting: Coffee,
  meeting_reservation: CalendarCheck2,
  holiday: PartyPopper,
  birthday: Cake,
  leave: Palmtree,
  event: ListChecks,
  notion: Gift,
  room: DoorOpen,
};

function formatDateLabel(date: Date) {
  return format(date, 'M월 d일 (EEE)', { locale: ko });
}

function formatEventTime(event: InternalCalendarEvent) {
  if (event.all_day) return shouldShowUnspecifiedCalendarTime(event) ? '시간 미지정' : '종일';
  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);
  return `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
}

function eventOverlapsDay(event: InternalCalendarEvent, day: Date) {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(startOfDay(day), 1).getTime();
  return new Date(event.starts_at).getTime() < dayEnd && new Date(event.ends_at).getTime() > dayStart;
}

function getCalendarIcon(event: InternalCalendarEvent) {
  return CALENDAR_ICON_MAP[getCalendarEventIconType(event)] || CalendarCheck2;
}

function isHolidayEvent(event: InternalCalendarEvent) {
  return event.source_type === 'holiday' || event.icon_type === 'holiday';
}

function isCompanyWideManualEvent(event: InternalCalendarEvent) {
  const calendarKind = event.metadata?.calendar_kind;
  return calendarKind === 'holiday'
    || calendarKind === 'event'
    || event.icon_type === 'holiday'
    || event.icon_type === 'event';
}

function buildCalendarKeys({
  event,
  userId,
}: {
  event: InternalCalendarEvent;
  userId?: string;
}) {
  const keys = new Set<string>();
  if (userId && (event.created_by === userId || event.participant_ids.includes(userId))) keys.add('mine');
  if (event.team_department) keys.add(`team:${event.team_department}`);
  if (event.created_by) keys.add(`user:${event.created_by}`);
  event.resource_ids.forEach((resourceId) => keys.add(`resource:${resourceId}`));
  if (['holiday', 'birthday', 'announcement_event', 'notion'].includes(event.source_type)) keys.add('company');
  if (isCompanyWideManualEvent(event)) keys.add('company');
  return keys;
}

const CalendarPage = () => {
  const { user, profile, isAdmin, isModerator } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canViewAll = isAdmin || isModerator;
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [scope, setScope] = useState<CalendarViewScope>(canViewAll ? 'all' : 'my');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [activeCalendars, setActiveCalendars] = useState<Set<string>>(() => new Set(['mine', 'company']));
  const [sourceFilters, setSourceFilters] = useState<Set<CalendarSourceFilter>>(() => new Set(DEFAULT_SOURCE_FILTERS));
  const [initializedCalendars, setInitializedCalendars] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'employee' | 'client' | 'room' | 'manual' | 'event' | 'holiday'>('manual');
  const [dialogDate, setDialogDate] = useState(() => new Date());
  const [editingEvent, setEditingEvent] = useState<InternalCalendarEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<InternalCalendarEvent | null>(null);
  const [subscriptionTarget, setSubscriptionTarget] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { rangeStart, rangeEnd } = getCalendarMonthRange(currentMonth);
  const { data: events = [], isLoading: isEventsLoading } = useCalendarEvents({
    rangeStart,
    rangeEnd,
    scope,
    enabled: !!user,
  });
  const { data: resources = [] } = useCalendarResources();
  const { data: employees = [] } = useCalendarDirectory();
  const { data: subscriptions = [] } = useCalendarSubscriptions(user?.id);

  useEffect(() => {
    const dateParam = searchParams.get('date');
    const viewParam = searchParams.get('view') as CalendarViewMode | null;
    if (dateParam) {
      const nextDate = new Date(`${dateParam}T00:00:00`);
      if (!Number.isNaN(nextDate.getTime())) {
        setSelectedDate(nextDate);
        setCurrentMonth(nextDate);
      }
    }
    if (viewParam === 'month' || viewParam === 'week' || viewParam === 'day') {
      setViewMode(viewParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!canViewAll) setScope('my');
  }, [canViewAll]);

  useEffect(() => {
    const eventId = searchParams.get('event');
    if (!eventId || events.length === 0) return;
    const event = events.find((item) => item.id === eventId);
    if (event) setSelectedEvent(event);
  }, [events, searchParams]);

  useEffect(() => {
    if (initializedCalendars) return;
    const next = new Set<string>(['mine', 'company']);
    if (profile?.department) next.add(`team:${profile.department}`);
    resources.forEach((resource) => next.add(`resource:${resource.id}`));
    subscriptions
      .filter((subscription) => subscription.is_visible)
      .forEach((subscription) => {
        if (subscription.target_type === 'user' && subscription.target_user_id) next.add(`user:${subscription.target_user_id}`);
        if (subscription.target_type === 'team' && subscription.target_department) next.add(`team:${subscription.target_department}`);
        if (subscription.target_type === 'resource' && subscription.target_resource_id) next.add(`resource:${subscription.target_resource_id}`);
      });
    setActiveCalendars(next);
    if (resources.length > 0 || subscriptions.length > 0 || profile?.department) setInitializedCalendars(true);
  }, [initializedCalendars, profile?.department, resources, subscriptions]);

  const departmentOptions = useMemo(() => {
    return [...new Set(employees.map((employee) => employee.department).filter(Boolean) as string[])].sort();
  }, [employees]);

  const visibleEvents = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    return events.filter((event) => {
      const calendarKeys = buildCalendarKeys({ event, userId: user?.id });
      const calendarVisible = (scope === 'all' && canViewAll)
        || activeCalendars.size === 0
        || [...calendarKeys].some((key) => activeCalendars.has(key));
      const sourceVisible = sourceFilters.has(getCalendarSourceFilter(event));
      const queryVisible = !keyword
        || [event.title, event.description, event.location, event.created_by_name, event.client_name, event.team_department]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(keyword));
      return calendarVisible && sourceVisible && queryVisible;
    });
  }, [activeCalendars, canViewAll, events, scope, searchQuery, sourceFilters, user?.id]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate);
    return eachDayOfInterval({ start, end: addDays(start, 6) });
  }, [selectedDate]);

  const listDays = viewMode === 'day' ? [selectedDate] : viewMode === 'week' ? weekDays : calendarDays;
  const listEvents = useMemo(() => {
    return listDays.map((day) => ({
      day,
      events: visibleEvents
        .filter((event) => eventOverlapsDay(event, day))
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    }));
  }, [listDays, visibleEvents]);

  const todayEvents = visibleEvents.filter((event) => eventOverlapsDay(event, new Date()));
  const nextEvent = visibleEvents
    .filter((event) => new Date(event.starts_at).getTime() >= Date.now())
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];
  const roomsInUse = resources.filter((resource) =>
    visibleEvents.some((event) =>
      event.resource_ids.includes(resource.id)
      && new Date(event.starts_at).getTime() <= Date.now()
      && new Date(event.ends_at).getTime() > Date.now(),
    ),
  );

  const toggleCalendar = (key: string) => {
    setActiveCalendars((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSourceFilter = (filter: CalendarSourceFilter) => {
    setSourceFilters((current) => {
      const next = new Set(current);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next.size === 0 ? new Set(DEFAULT_SOURCE_FILTERS) : next;
    });
  };

  const openSourcePath = (event: InternalCalendarEvent) => {
    if (!event.source_path) return false;
    if (/^https?:\/\//i.test(event.source_path)) {
      window.open(event.source_path, '_blank', 'noopener,noreferrer');
    } else {
      navigate(event.source_path);
    }
    return true;
  };

  const openNewEvent = (mode: 'employee' | 'client' | 'room' | 'manual' | 'event' | 'holiday', date = selectedDate) => {
    setDialogMode(mode);
    setEditingEvent(null);
    setSelectedDate(date);
    setDialogDate(date);
    setDialogOpen(true);
  };

  const openEvent = (event: InternalCalendarEvent) => {
    setSelectedEvent(event);
    if (!event.can_edit && openSourcePath(event)) return;
  };

  const handleSubscribeUser = async () => {
    if (!user || !subscriptionTarget) return;
    const target = employees.find((employee) => employee.id === subscriptionTarget);
    if (!target) return;

    const existing = subscriptions.find(
      (subscription) => subscription.target_type === 'user' && subscription.target_user_id === target.id,
    );

    const { error } = existing
      ? await supabaseAny
          .from('calendar_subscriptions')
          .update({ is_visible: true, display_name: target.full_name })
          .eq('id', existing.id)
      : await supabaseAny
          .from('calendar_subscriptions')
          .insert({
            subscriber_id: user.id,
            target_type: 'user',
            target_user_id: target.id,
            display_name: target.full_name,
            color: '#111111',
            is_visible: true,
          });

    if (error) {
      toast.error('캘린더 구독에 실패했습니다.');
      return;
    }

    setActiveCalendars((current) => new Set(current).add(`user:${target.id}`));
    setSubscriptionTarget('');
    toast.success(`${target.full_name} 캘린더를 구독했습니다.`);
    queryClient.invalidateQueries({ queryKey: ['calendar-subscriptions'] });
    queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
  };

  const handleUnsubscribe = async (subscription: CalendarSubscription) => {
    const { error } = await supabaseAny.from('calendar_subscriptions').delete().eq('id', subscription.id);
    if (error) {
      toast.error('구독 해제에 실패했습니다.');
      return;
    }

    if (subscription.target_user_id) {
      setActiveCalendars((current) => {
        const next = new Set(current);
        next.delete(`user:${subscription.target_user_id}`);
        return next;
      });
    }
    queryClient.invalidateQueries({ queryKey: ['calendar-subscriptions'] });
    queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
  };

  const renderCalendarToggle = (key: string, title: string, description?: string) => {
    const active = activeCalendars.has(key);
    return (
      <button
        key={key}
        type="button"
        onClick={() => toggleCalendar(key)}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
          active ? 'border-[#111111] bg-[#111111] text-white' : 'border-[#e5e5e5] bg-white text-[#111111] hover:border-[#cacacb]',
        )}
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{title}</span>
          {description && <span className={cn('block truncate text-xs', active ? 'text-white/70' : 'text-[#707072]')}>{description}</span>}
        </span>
        <span className={cn('h-2.5 w-2.5 rounded-full', active ? 'bg-white' : 'bg-[#cacacb]')} />
      </button>
    );
  };

  const renderSourceFilter = (filter: (typeof CALENDAR_SOURCE_FILTERS)[number]) => {
    const active = sourceFilters.has(filter.value);
    return (
      <button
        key={filter.value}
        type="button"
        onClick={() => toggleSourceFilter(filter.value)}
        className={cn(
          'h-8 rounded-full border px-3 text-xs font-semibold transition-colors',
          active ? 'border-[#111111] bg-[#111111] text-white' : 'border-[#cacacb] bg-white text-[#707072] hover:text-[#111111]',
        )}
        title={filter.description}
      >
        {filter.label}
      </button>
    );
  };

  const renderEventPill = (event: InternalCalendarEvent, compact = false) => {
    const accent = getCalendarEventAccent(event);
    const Icon = getCalendarIcon(event);
    const timeLabel = event.all_day ? '' : `${format(new Date(event.starts_at), 'HH:mm')} `;
    return (
      <button
        key={event.id}
        type="button"
        onClick={() => openEvent(event)}
        className={cn(
          'w-full rounded-md border px-2 py-1 text-left transition-colors hover:border-[#111111]',
          compact ? 'text-[10px] leading-4' : 'text-xs leading-5',
        )}
        style={{
          borderColor: `${accent}33`,
          backgroundColor: `${accent}12`,
          color: accent,
        }}
        title={event.title}
      >
        <span className="flex min-w-0 items-center gap-1 font-semibold">
          <Icon className="h-3 w-3 shrink-0" />
          <span className="truncate">{timeLabel}{event.title}</span>
        </span>
        {!compact && (
          <span className="block truncate pl-4 text-[11px] opacity-70">
            {[event.location, event.resource_names.join(', '), event.client_name].filter(Boolean).join(' · ') || event.created_by_name}
          </span>
        )}
      </button>
    );
  };

  return (
    <PageShell maxWidth="7xl" className="bg-white">
      <PageHeader
        eyebrow="Calendar"
        title="통합 캘린더"
        description="개인, 팀, 담당자, 회의실 일정을 한 화면에서 확인하고 예약합니다."
        icon={<CalendarCheck2 className="h-5 w-5" />}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            {canViewAll && (
              <div className="flex rounded-full border border-[#cacacb] bg-white p-1">
                {[
                  { value: 'my', label: '내 일정' },
                  { value: 'all', label: '전체 일정' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setScope(option.value as CalendarViewScope)}
                    className={cn(
                      'h-8 rounded-full px-3 text-xs font-semibold transition-colors',
                      scope === option.value ? 'bg-[#111111] text-white' : 'text-[#707072] hover:text-[#111111]',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
            <Button className="h-9 rounded-full bg-[#111111] px-4 text-white hover:bg-[#39393b]" onClick={() => openNewEvent('manual')}>
              <Plus className="mr-2 h-4 w-4" />
              일정 등록
            </Button>
          </div>
        )}
      />

      <section className="grid gap-3 sm:grid-cols-4">
        {[
          { label: '오늘 일정', value: todayEvents.length, action: () => setViewMode('day') },
          { label: '다음 일정', value: nextEvent ? formatEventTime(nextEvent) : '-', action: () => nextEvent && setSelectedEvent(nextEvent) },
          { label: '회의실 사용 중', value: roomsInUse.length, action: () => setViewMode('day') },
          { label: '이번 달 표시', value: visibleEvents.length, action: () => setViewMode('month') },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.action}
            className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-4 text-left transition-colors hover:border-[#cacacb]"
          >
            <p className="text-xs font-medium text-[#707072]">{item.label}</p>
            <p className="mt-2 text-2xl font-bold leading-none text-[#111111]">{item.value}</p>
          </button>
        ))}
      </section>

      <section className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {CALENDAR_SOURCE_FILTERS.map(renderSourceFilter)}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#707072]">
            {CALENDAR_EVENT_LEGEND.map((item) => (
              <span key={item.key} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.accent }} />
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="grid min-h-[720px] gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="space-y-4 rounded-lg border border-[#e5e5e5] bg-white p-4">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase text-[#707072]">내 캘린더</p>
            {renderCalendarToggle('mine', '내 캘린더', profile?.department || '개인 일정')}
            {renderCalendarToggle('company', '회사 공용 일정', '휴일, 생일, 공지 이벤트')}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase text-[#707072]">팀 캘린더</p>
            {departmentOptions.length > 0 ? departmentOptions.map((department) =>
              renderCalendarToggle(`team:${department}`, department, department === profile?.department ? '내 소속팀' : '팀 일정'),
            ) : (
              <div className="rounded-lg border border-dashed border-[#e5e5e5] p-3 text-sm text-[#707072]">등록된 팀 정보가 없습니다.</div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase text-[#707072]">다른 사람 구독</p>
            <div className="grid gap-2">
              {subscriptions.filter((subscription) => subscription.target_type === 'user').map((subscription) => (
                <div key={subscription.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    {renderCalendarToggle(`user:${subscription.target_user_id}`, subscription.display_name || '직원 캘린더', '제목까지 공개')}
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 rounded-full px-2 text-xs" onClick={() => handleUnsubscribe(subscription)}>
                    해제
                  </Button>
                </div>
              ))}
              <div className="grid gap-2">
                <Select value={subscriptionTarget} onValueChange={setSubscriptionTarget}>
                  <SelectTrigger className="h-9 rounded-full border-[#cacacb] bg-white text-xs">
                    <SelectValue placeholder="직원 캘린더 구독" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees
                      .filter((employee) => employee.id !== user?.id)
                      .map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.full_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" className="h-9 rounded-full border-[#cacacb] text-xs" disabled={!subscriptionTarget} onClick={handleSubscribeUser}>
                  구독 추가
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase text-[#707072]">회의실</p>
            {resources.map((resource: CalendarResource) =>
              renderCalendarToggle(`resource:${resource.id}`, resource.name, resource.description || resource.floor || '회의실 캘린더'),
            )}
          </div>
        </aside>

        <main className="min-w-0 rounded-lg border border-[#e5e5e5] bg-white">
          <div className="flex flex-col gap-3 border-b border-[#e5e5e5] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-[#cacacb]" onClick={() => setCurrentMonth((current) => subMonths(current, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="min-w-[150px] text-center text-base font-bold text-[#111111]">
                {format(currentMonth, 'yyyy년 M월', { locale: ko })}
              </h2>
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-[#cacacb]" onClick={() => setCurrentMonth((current) => addMonths(current, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                className="h-9 rounded-full px-3 text-xs"
                onClick={() => {
                  const today = new Date();
                  setCurrentMonth(today);
                  setSelectedDate(today);
                }}
              >
                오늘
              </Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9e9ea0]" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="일정 검색"
                  className="h-9 rounded-full border-[#cacacb] bg-white pl-8 text-sm sm:w-56"
                />
              </div>
              <div className="flex rounded-full border border-[#cacacb] bg-white p-1">
                {[
                  { value: 'month', label: '월' },
                  { value: 'week', label: '주' },
                  { value: 'day', label: '일' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setViewMode(option.value as CalendarViewMode)}
                    className={cn(
                      'h-8 rounded-full px-3 text-xs font-semibold transition-colors',
                      viewMode === option.value ? 'bg-[#111111] text-white' : 'text-[#707072] hover:text-[#111111]',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {viewMode === 'month' ? (
            <>
              <div className="grid grid-cols-7 border-b border-[#e5e5e5] bg-[#fafafa] text-center text-xs font-semibold text-[#707072]">
                {WEEKDAY_LABELS.map((weekday) => (
                  <div key={weekday} className="py-2">{weekday}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {calendarDays.map((day) => {
                  const dayEvents = visibleEvents
                    .filter((event) => eventOverlapsDay(event, day))
                    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
                  const visibleDayEvents = dayEvents.filter((event) => !isHolidayEvent(event));
                  const hasHoliday = dayEvents.some(isHolidayEvent);
                  const muted = !isSameMonth(day, currentMonth);
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'min-h-[118px] border-b border-r border-[#e5e5e5] p-2',
                        muted && 'bg-[#fafafa] text-[#9e9ea0]',
                        hasHoliday && 'bg-red-500/10',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDate(day);
                          openNewEvent('manual', day);
                        }}
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                          isToday(day) ? 'bg-[#111111] text-white' : 'hover:bg-[#f5f5f5]',
                        )}
                      >
                        {format(day, 'd')}
                      </button>
                      <div className="mt-1 space-y-1">
                        {visibleDayEvents.slice(0, 3).map((event) => renderEventPill(event, true))}
                        {visibleDayEvents.length > 3 && (
                          <button
                            type="button"
                            className="text-[10px] font-semibold text-[#707072] hover:text-[#111111]"
                            onClick={() => {
                              setSelectedDate(day);
                              setViewMode('day');
                            }}
                          >
                            +{visibleDayEvents.length - 3}건 더보기
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="divide-y divide-[#e5e5e5]">
              {listEvents.map(({ day, events: dayEvents }) => (
                <section key={day.toISOString()} className="grid gap-3 p-4 md:grid-cols-[120px_minmax(0,1fr)]">
                  <div>
                    <p className="text-sm font-bold text-[#111111]">{formatDateLabel(day)}</p>
                    <p className="mt-1 text-xs text-[#707072]">{dayEvents.length}개 일정</p>
                  </div>
                  <div className="space-y-2">
                    {dayEvents.length > 0 ? dayEvents.map((event) => renderEventPill(event)) : (
                      <button
                        type="button"
                        onClick={() => openNewEvent('manual', day)}
                        className="w-full rounded-lg border border-dashed border-[#cacacb] bg-[#fafafa] p-4 text-left text-sm text-[#707072] hover:border-[#111111]"
                      >
                        일정 없음. 클릭해서 새 일정을 등록하세요.
                      </button>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </main>

        <aside className="space-y-4 rounded-lg border border-[#e5e5e5] bg-white p-4">
          <div>
            <p className="text-xs font-bold uppercase text-[#707072]">빠른 예약</p>
            <div className="mt-2 grid gap-2">
              <Button className="h-10 justify-start rounded-full bg-[#111111] text-white hover:bg-[#39393b]" onClick={() => openNewEvent('employee')}>
                <UsersRound className="mr-2 h-4 w-4" /> 직원 1:1/팀 미팅
              </Button>
              <Button variant="outline" className="h-10 justify-start rounded-full border-[#cacacb]" onClick={() => openNewEvent('client')}>
                <CalendarCheck2 className="mr-2 h-4 w-4" /> 클라이언트 미팅
              </Button>
              <Button variant="outline" className="h-10 justify-start rounded-full border-[#cacacb]" onClick={() => openNewEvent('room')}>
                <DoorOpen className="mr-2 h-4 w-4" /> 회의실 예약
              </Button>
              <Button variant="outline" className="h-10 justify-start rounded-full border-[#cacacb]" onClick={() => openNewEvent('manual')}>
                <CalendarCheck2 className="mr-2 h-4 w-4" /> 일반 일정
              </Button>
              <Button variant="outline" className="h-10 justify-start rounded-full border-[#cacacb]" onClick={() => openNewEvent('event')}>
                <ListChecks className="mr-2 h-4 w-4" /> 이벤트
              </Button>
              <Button variant="outline" className="h-10 justify-start rounded-full border-[#cacacb]" onClick={() => openNewEvent('holiday')}>
                <PartyPopper className="mr-2 h-4 w-4" /> 휴무일
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-[#707072]" />
              <p className="text-sm font-bold text-[#111111]">다음 일정</p>
            </div>
            {nextEvent ? (
              <button type="button" className="mt-3 w-full text-left" onClick={() => setSelectedEvent(nextEvent)}>
                <p className="text-sm font-semibold text-[#111111]">{nextEvent.title}</p>
                <p className="mt-1 text-xs text-[#707072]">
                  {formatDateLabel(new Date(nextEvent.starts_at))} {formatEventTime(nextEvent)}
                </p>
              </button>
            ) : (
              <p className="mt-3 text-sm text-[#707072]">예정된 일정이 없습니다.</p>
            )}
          </div>

          <div>
            <p className="text-xs font-bold uppercase text-[#707072]">회의실 현황</p>
            <div className="mt-2 grid gap-2">
              {resources.map((resource) => {
                const current = visibleEvents.find((event) =>
                  event.resource_ids.includes(resource.id)
                  && new Date(event.starts_at).getTime() <= Date.now()
                  && new Date(event.ends_at).getTime() > Date.now(),
                );
                const next = visibleEvents
                  .filter((event) => event.resource_ids.includes(resource.id) && new Date(event.starts_at).getTime() >= Date.now())
                  .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];
                return (
                  <div key={resource.id} className="rounded-lg border border-[#e5e5e5] bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#111111]">{resource.name}</p>
                      <Badge variant="outline" className={cn('rounded-full px-2 py-0 text-[10px]', current && 'border-[#111111] bg-[#111111] text-white')}>
                        {current ? '사용 중' : '비어 있음'}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-[#707072]">
                      {current ? `${current.title} · ${formatEventTime(current)}` : next ? `다음 ${format(new Date(next.starts_at), 'M/d HH:mm')} ${next.title}` : '예정 예약 없음'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-[#e5e5e5] bg-white p-3">
            <p className="text-sm font-bold text-[#111111]">상세</p>
            {selectedEvent ? (
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <p className="font-semibold text-[#111111]">{selectedEvent.title}</p>
                  <p className="mt-1 text-xs text-[#707072]">
                    {formatDateLabel(new Date(selectedEvent.starts_at))} {formatEventTime(selectedEvent)}
                  </p>
                </div>
                {(selectedEvent.location || selectedEvent.resource_names.length > 0) && (
                  <p className="flex items-center gap-1.5 text-xs text-[#707072]">
                    <MapPin className="h-3.5 w-3.5" />
                    {[selectedEvent.location, selectedEvent.resource_names.join(', ')].filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="rounded-full">{CALENDAR_STATUS_LABELS[selectedEvent.status]}</Badge>
                  {selectedEvent.is_redacted && <Badge variant="secondary" className="rounded-full">상세 제한</Badge>}
                  {!selectedEvent.can_edit && <Badge variant="secondary" className="rounded-full">읽기 전용</Badge>}
                </div>
                {selectedEvent.description && (
                  <p className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3 text-xs leading-5 text-[#39393b]">
                    {selectedEvent.description}
                  </p>
                )}
                {selectedEvent.can_edit && (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="h-9 w-full rounded-full border-[#cacacb]"
                      onClick={() => {
                        setEditingEvent(selectedEvent);
                        setDialogOpen(true);
                      }}
                    >
                      일정 수정
                    </Button>
                    <CalendarEventDeleteActions
                      event={selectedEvent}
                      onDeleted={() => {
                        setSelectedEvent(null);
                        setEditingEvent(null);
                      }}
                    />
                  </div>
                )}
                {selectedEvent.source_path && (
                  <Button
                    variant={selectedEvent.can_edit ? 'ghost' : 'outline'}
                    className="h-9 w-full rounded-full border-[#cacacb]"
                    onClick={() => openSourcePath(selectedEvent)}
                  >
                    원본 보기
                  </Button>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-[#707072]">일정을 선택하면 상세 정보가 표시됩니다.</p>
            )}
          </div>
        </aside>
      </section>

      {isEventsLoading && (
        <div className="fixed bottom-5 right-5 flex items-center gap-2 rounded-full border border-[#e5e5e5] bg-white px-4 py-2 text-sm text-[#707072] shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          캘린더 동기화 중
        </div>
      )}

      <CalendarEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editingEvent}
        events={events}
        defaultDate={format(dialogDate, 'yyyy-MM-dd')}
        defaultMode={dialogMode}
        onSaved={() => {
          setEditingEvent(null);
          setSelectedEvent(null);
        }}
      />
    </PageShell>
  );
};

export default CalendarPage;
