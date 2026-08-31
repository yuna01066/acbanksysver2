import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfWeek,
  format,
  isAfter,
  isBefore,
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
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  LockKeyhole,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import type {
  PublicBookingLinkPublic,
  PublicBookingScheduleBlock,
  PublicBookingScheduleView,
  PublicBookingSlot,
} from '@/types/publicBooking';

type PublicRoomScheduleViewerProps = {
  slug: string;
  link: PublicBookingLinkPublic;
  accessCode: string;
  selectedDate: string;
  slots: PublicBookingSlot[];
  selectedSlotKey: string;
  isSlotsLoading: boolean;
  onSelectDate: (date: string) => void;
  onSelectSlot: (slotKey: string) => void;
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const ROOM_COLORS = ['#2563eb', '#0f766e', '#334155', '#92400e'];

function dateKey(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function parseDateKey(value: string) {
  return new Date(`${value}T00:00:00+09:00`);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return String(record.message || record.error || record.details || '시간표를 불러오지 못했습니다.');
  }
  return '시간표를 불러오지 못했습니다.';
}

function clockToMinutes(value: string) {
  const [hour, minute] = value.slice(0, 5).split(':').map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

function minutesToClock(value: number) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function slotRange(date: string, startMinutes: number, durationMinutes: number) {
  const startsAt = new Date(`${date}T${minutesToClock(startMinutes)}:00+09:00`);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  return { startsAt, endsAt };
}

function overlaps(block: PublicBookingScheduleBlock, startsAt: Date, endsAt: Date) {
  const blockStart = new Date(block.startsAt);
  const blockEnd = new Date(block.endsAt);
  return blockStart < endsAt && blockEnd > startsAt;
}

function containsTime(block: PublicBookingScheduleBlock, value: Date) {
  const blockStart = new Date(block.startsAt);
  const blockEnd = new Date(block.endsAt);
  return blockStart <= value && blockEnd > value;
}

function formatBlockTime(block: PublicBookingScheduleBlock) {
  const startsAt = new Date(block.startsAt);
  const endsAt = new Date(block.endsAt);
  return `${format(startsAt, 'HH:mm')} - ${format(endsAt, 'HH:mm')}`;
}

function getBlockCompanyLabel(block: PublicBookingScheduleBlock) {
  return block.publicCompanyName?.trim() || '회사명 미입력';
}

function getBlockPurposeLabel(block: PublicBookingScheduleBlock) {
  return block.publicPurpose?.trim() || '용무 미입력';
}

function getSlotKey(slot: PublicBookingSlot) {
  return `${slot.meetingMode}:${slot.resourceId || 'none'}:${slot.time}`;
}

function getRangeLabel(view: PublicBookingScheduleView, anchorDate: Date) {
  if (view === 'month') return format(anchorDate, 'yyyy년 M월', { locale: ko });
  if (view === 'week') {
    const start = startOfWeek(anchorDate, { weekStartsOn: 0 });
    const end = endOfWeek(anchorDate, { weekStartsOn: 0 });
    return `${format(start, 'M월 d일', { locale: ko })} - ${format(end, 'M월 d일', { locale: ko })}`;
  }
  return format(anchorDate, 'M월 d일 EEEE', { locale: ko });
}

function getResourceColor(resourceId: string, resourceIds: string[]) {
  const index = Math.max(0, resourceIds.indexOf(resourceId));
  return ROOM_COLORS[index % ROOM_COLORS.length];
}

function getStatusLabel(status: PublicBookingScheduleBlock['status']) {
  return status === 'pending_review' ? '승인 대기' : '사용 중';
}

function getBlockDateKey(block: PublicBookingScheduleBlock) {
  return format(new Date(block.startsAt), 'yyyy-MM-dd');
}

function normalizeScheduleStatus(value: unknown, kind: unknown): PublicBookingScheduleBlock['status'] {
  if (value === 'pending_review' || value === 'pending' || kind === 'pending_review' || kind === 'pending') {
    return 'pending_review';
  }
  return 'confirmed';
}

function normalizeScheduleSource(value: unknown, sourceType: unknown): PublicBookingScheduleBlock['source'] {
  if (value === 'public_request' || sourceType === 'public_request') return 'public_request';
  return 'calendar_event';
}

function normalizeScheduleBlock(value: unknown): PublicBookingScheduleBlock | null {
  if (!value || typeof value !== 'object') return null;
  const block = value as Record<string, unknown>;
  const resourceId = typeof block.resourceId === 'string' ? block.resourceId : '';
  const resourceName = typeof block.resourceName === 'string' ? block.resourceName : '';
  const startsAt = typeof block.startsAt === 'string' ? block.startsAt : '';
  const endsAt = typeof block.endsAt === 'string' ? block.endsAt : '';
  if (!resourceId || !resourceName || !startsAt || !endsAt) return null;

  const status = normalizeScheduleStatus(block.status, block.kind);
  const source = normalizeScheduleSource(block.source, block.sourceType);
  return {
    id: typeof block.id === 'string' ? block.id : undefined,
    resourceId,
    resourceName,
    resourceFloor: typeof block.resourceFloor === 'string' ? block.resourceFloor : null,
    startsAt,
    endsAt,
    status,
    source,
    kind: status === 'pending_review' ? 'pending' : 'confirmed',
    sourceType: source,
    date: typeof block.date === 'string' ? block.date : getBlockDateKey({ resourceId, resourceName, resourceFloor: null, startsAt, endsAt, status, source }),
    allDay: Boolean(block.allDay),
    time: typeof block.time === 'string' ? block.time : format(new Date(startsAt), 'HH:mm'),
    label: typeof block.label === 'string' ? block.label : `${format(new Date(startsAt), 'HH:mm')} - ${format(new Date(endsAt), 'HH:mm')}`,
    publicCompanyName: typeof block.publicCompanyName === 'string' ? block.publicCompanyName : null,
    publicPurpose: typeof block.publicPurpose === 'string' ? block.publicPurpose : null,
  };
}

function isAllowedBookingDate(date: Date, link: PublicBookingLinkPublic) {
  const today = startOfDay(new Date());
  const day = startOfDay(date);
  const maxDate = startOfDay(addDays(today, link.rules.maxDaysAhead));
  return !isBefore(day, today)
    && !isAfter(day, maxDate)
    && link.rules.allowedWeekdays.includes(day.getDay());
}

export function PublicRoomScheduleViewer({
  slug,
  link,
  accessCode,
  selectedDate,
  slots,
  selectedSlotKey,
  isSlotsLoading,
  onSelectDate,
  onSelectSlot,
}: PublicRoomScheduleViewerProps) {
  const [view, setView] = useState<PublicBookingScheduleView>('month');
  const [anchorDate, setAnchorDate] = useState(() => startOfMonth(parseDateKey(selectedDate)));
  const [blocks, setBlocks] = useState<PublicBookingScheduleBlock[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const isLocked = link.requiresAccessCode && !accessCode.trim();
  const selectedDateValue = useMemo(() => parseDateKey(selectedDate), [selectedDate]);
  const resourceIds = useMemo(() => link.resources.map((resource) => resource.id), [link.resources]);

  useEffect(() => {
    const nextDate = parseDateKey(selectedDate);
    setAnchorDate((current) => (isSameMonth(nextDate, current) ? current : startOfMonth(nextDate)));
  }, [selectedDate]);

  useEffect(() => {
    let mounted = true;
    const loadSchedule = async () => {
      if (isLocked) {
        setBlocks([]);
        return;
      }

      setIsLoading(true);
      setError('');
      try {
        const { data, error: invokeError } = await supabase.functions.invoke('public-meeting-booking', {
          body: {
            action: 'get-schedule',
            slug,
            view,
            date: dateKey(view === 'month' ? anchorDate : selectedDateValue),
            accessCode,
          },
        });
        if (invokeError) throw invokeError;
        if (data?.error) throw new Error(String(data.error));
        if (mounted) {
          setBlocks(((data?.blocks || []) as unknown[])
            .map(normalizeScheduleBlock)
            .filter((block): block is PublicBookingScheduleBlock => Boolean(block)));
        }
      } catch (nextError) {
        if (mounted) {
          setBlocks([]);
          setError(getErrorMessage(nextError));
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadSchedule();
    return () => {
      mounted = false;
    };
  }, [accessCode, anchorDate, isLocked, selectedDateValue, slug, view]);

  const blocksByDate = useMemo(() => {
    const grouped = new Map<string, PublicBookingScheduleBlock[]>();
    blocks.forEach((block) => {
      const key = getBlockDateKey(block);
      const current = grouped.get(key) || [];
      current.push(block);
      grouped.set(key, current);
    });
    grouped.forEach((items) => items.sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    return grouped;
  }, [blocks]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 0 });
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [anchorDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDateValue, { weekStartsOn: 0 });
    const end = endOfWeek(selectedDateValue, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [selectedDateValue]);

  const visibleDays = view === 'week' ? weekDays : view === 'day' ? [selectedDateValue] : monthDays;
  const selectedDayBlocks = blocksByDate.get(selectedDate) || [];

  const blocksByResourceForSelectedDate = useMemo(() => {
    const grouped = new Map<string, PublicBookingScheduleBlock[]>();
    selectedDayBlocks.forEach((block) => {
      const current = grouped.get(block.resourceId) || [];
      current.push(block);
      grouped.set(block.resourceId, current);
    });
    grouped.forEach((items) => items.sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    return grouped;
  }, [selectedDayBlocks]);

  const selectedDateSlots = useMemo(
    () => [...slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [slots],
  );

  const availableResourceCount = useMemo(() => {
    const resourceSet = new Set(selectedDateSlots.map((slot) => slot.resourceId).filter(Boolean));
    return resourceSet.size;
  }, [selectedDateSlots]);

  const timeRows = useMemo(() => {
    const start = clockToMinutes(link.rules.startTime);
    const end = clockToMinutes(link.rules.endTime);
    const rows: number[] = [];
    for (let cursor = start; cursor + link.rules.durationMinutes <= end; cursor += link.rules.slotMinutes) {
      rows.push(cursor);
    }
    return rows;
  }, [link.rules.durationMinutes, link.rules.endTime, link.rules.slotMinutes, link.rules.startTime]);

  const todayKey = dateKey(new Date());
  const todayBlocks = blocksByDate.get(todayKey) || [];
  const now = new Date();
  const roomsInUseNow = new Set(todayBlocks.filter((block) => containsTime(block, now)).map((block) => block.resourceId)).size;
  const nextAvailableSlot = selectedDateSlots.find((slot) => new Date(slot.startsAt) > now) || selectedDateSlots[0] || null;
  const canShowPublicDetails = Boolean(link.publicScheduleDetailsEnabled);

  const moveRange = (direction: -1 | 1) => {
    if (view === 'month') {
      setAnchorDate((current) => (direction > 0 ? addMonths(current, 1) : subMonths(current, 1)));
      return;
    }

    const nextDate = addDays(selectedDateValue, direction * (view === 'week' ? 7 : 1));
    setAnchorDate(startOfMonth(nextDate));
    onSelectDate(dateKey(nextDate));
  };

  const selectDate = (date: Date) => {
    const key = dateKey(date);
    onSelectDate(key);
  };

  const goToday = () => {
    const today = new Date();
    setAnchorDate(startOfMonth(today));
    onSelectDate(dateKey(today));
  };

  const renderCalendarDot = (block: PublicBookingScheduleBlock, index: number) => {
    const color = getResourceColor(block.resourceId, resourceIds);
    return (
      <HoverCard key={`${block.resourceId}-${block.startsAt}-${index}`} openDelay={120} closeDelay={80}>
        <HoverCardTrigger asChild>
          <span
            data-testid="public-room-schedule-dot"
            title={`${block.resourceName} ${getStatusLabel(block.status)} ${formatBlockTime(block)}`}
            className={cn(
              'h-2.5 w-2.5 shrink-0 rounded-full outline-none ring-offset-background transition-transform hover:scale-125 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              block.status === 'pending_review' && 'border border-dashed bg-transparent',
            )}
            style={{
              backgroundColor: block.status === 'confirmed' ? color : 'transparent',
              borderColor: color,
            }}
          />
        </HoverCardTrigger>
        <HoverCardContent align="start" side="top" className="w-72 rounded-lg border-border bg-card p-3 text-sm shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-bold text-foreground">
                {canShowPublicDetails ? getBlockCompanyLabel(block) : block.resourceName}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{block.resourceName} · {formatBlockTime(block)}</p>
            </div>
            <Badge variant="outline" className={cn('shrink-0 rounded-full text-[11px]', block.status === 'pending_review' && 'border-dashed')}>
              {getStatusLabel(block.status)}
            </Badge>
          </div>
          {canShowPublicDetails ? (
            <div className="mt-3 rounded-md border border-border bg-muted/20 px-3 py-2">
              <p className="text-[11px] font-semibold text-muted-foreground">용무</p>
              <p className="mt-1 line-clamp-3 text-sm leading-5 text-foreground">{getBlockPurposeLabel(block)}</p>
            </div>
          ) : (
            <p className="mt-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              세부 정보는 공개되지 않습니다.
            </p>
          )}
        </HoverCardContent>
      </HoverCard>
    );
  };

  return (
    <section className="rounded-lg border border-border bg-card shadow-none">
      <div className="border-b border-border p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-bold">회의실 이용 시간표</h2>
              {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {canShowPublicDetails
                ? '같은 공유 링크 예약의 회사명, 시간, 용무만 표시합니다.'
                : '내부 일정 제목은 숨기고 회의실 점유 상태만 표시합니다.'}
            </p>
          </div>
          <div className="inline-flex rounded-full border border-border bg-background p-1">
            {(['month', 'week', 'day'] as PublicBookingScheduleView[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setView(item)}
                className={cn(
                  'h-8 rounded-full px-3 text-xs font-semibold transition-colors',
                  view === item
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {item === 'month' ? '월간' : item === 'week' ? '주간' : '일간'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">오늘 예약</p>
            <p className="mt-2 text-2xl font-bold">{todayBlocks.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">다음 가능 시간</p>
            <p className="mt-2 truncate text-lg font-bold">
              {nextAvailableSlot ? `${nextAvailableSlot.time} ${nextAvailableSlot.resourceName}` : '없음'}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">현재 사용 중</p>
            <p className="mt-2 text-2xl font-bold">{roomsInUseNow}</p>
          </div>
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">선택일 가능 회의실</p>
            <p className="mt-2 text-2xl font-bold">{availableResourceCount}</p>
          </div>
        </div>
      </div>

      {isLocked ? (
        <div className="p-5">
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-5 text-center">
            <LockKeyhole className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold">접근 코드가 필요합니다.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              코드를 입력하면 회의실 이용 시간표와 예약 가능 시간을 볼 수 있습니다.
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="p-5">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        </div>
      ) : (
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 border-b border-border xl:border-b-0 xl:border-r">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  onClick={() => moveRange(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <p className="min-w-32 text-center text-lg font-bold">{getRangeLabel(view, view === 'month' ? anchorDate : selectedDateValue)}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  onClick={() => moveRange(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" className="h-9 rounded-full px-3 text-xs" onClick={goToday}>
                  오늘
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {link.resources.map((resource) => (
                  <span key={resource.id} className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: getResourceColor(resource.id, resourceIds) }}
                    />
                    {resource.name}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full border border-dashed border-foreground bg-transparent" />
                  승인 대기
                </span>
              </div>
            </div>

            <div className="overflow-hidden">
              {view !== 'day' && (
                <div className="grid grid-cols-7 border-b border-border bg-muted/20 text-center text-xs font-semibold text-muted-foreground">
                  {WEEKDAYS.map((day) => (
                    <div key={day} className="py-2">{day}</div>
                  ))}
                </div>
              )}
              <div className={cn('grid', view === 'day' ? 'grid-cols-1' : 'grid-cols-7')}>
                {visibleDays.map((day) => {
                  const key = dateKey(day);
                  const dayBlocks = blocksByDate.get(key) || [];
                  const selected = selectedDate === key;
                  const visibleBlocks = dayBlocks.slice(0, view === 'day' ? 12 : 4);
                  const isDateDisabled = !isAllowedBookingDate(day, link);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => selectDate(day)}
                      disabled={isDateDisabled}
                      className={cn(
                        'min-h-28 border-b border-r border-border bg-card p-3 text-left transition-colors last:border-r-0 hover:bg-muted/20 disabled:cursor-not-allowed',
                        view === 'day' && 'min-h-0 border-r-0',
                        view === 'week' && 'min-h-44',
                        !isSameMonth(day, anchorDate) && view === 'month' && 'bg-muted/10 text-muted-foreground',
                        isDateDisabled && 'text-muted-foreground',
                        selected && 'bg-foreground/[0.04] ring-1 ring-inset ring-foreground',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold',
                            isToday(day) && 'bg-foreground text-background',
                          )}
                        >
                          {format(day, 'd')}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {visibleBlocks.map((block, index) => renderCalendarDot(block, index))}
                        {dayBlocks.length > visibleBlocks.length && (
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            +{dayBlocks.length - visibleBlocks.length}
                          </span>
                        )}
                      </div>
                      {view === 'day' && (
                        <div className="mt-4 overflow-auto rounded-lg border border-border">
                          <div
                            className="grid min-w-[620px] border-b border-border bg-muted/20"
                            style={{ gridTemplateColumns: `78px repeat(${Math.max(link.resources.length, 1)}, minmax(140px, 1fr))` }}
                          >
                            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">시간</div>
                            {link.resources.map((resource) => (
                              <div key={resource.id} className="border-l border-border px-3 py-2 text-xs font-bold">
                                {resource.name}
                              </div>
                            ))}
                          </div>
                          {timeRows.map((startMinutes) => {
                            const { startsAt, endsAt } = slotRange(key, startMinutes, link.rules.durationMinutes);
                            return (
                              <div
                                key={startMinutes}
                                className="grid min-w-[620px] border-b border-border last:border-b-0"
                                style={{ gridTemplateColumns: `78px repeat(${Math.max(link.resources.length, 1)}, minmax(140px, 1fr))` }}
                              >
                                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">{minutesToClock(startMinutes)}</div>
                                {link.resources.map((resource) => {
                                  const busyBlock = dayBlocks.find((block) => block.resourceId === resource.id && overlaps(block, startsAt, endsAt));
                                  return (
                                    <span
                                      key={`${resource.id}-${startMinutes}`}
                                      className={cn(
                                        'border-l border-border px-3 py-2 text-xs',
                                        busyBlock
                                          ? 'bg-muted/50 text-muted-foreground'
                                          : 'bg-card text-foreground',
                                      )}
                                    >
                                      {busyBlock ? getStatusLabel(busyBlock.status) : '예약 가능'}
                                    </span>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="flex min-h-[520px] flex-col bg-card p-4">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
              <div>
                <p className="text-lg font-bold">{format(selectedDateValue, 'M월 d일 EEEE', { locale: ko })}</p>
                <p className="mt-1 text-xs text-muted-foreground">회의실별 사용 구간과 예약 가능 시간을 확인하세요.</p>
              </div>
              <Badge variant="outline" className="rounded-full">{selectedDayBlocks.length}건</Badge>
            </div>

            <div className="mt-4 space-y-3">
              {link.resources.map((resource) => {
                const resourceBlocks = blocksByResourceForSelectedDate.get(resource.id) || [];
                const color = getResourceColor(resource.id, resourceIds);
                return (
                  <div key={resource.id} className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 font-bold">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                        {resource.name}
                      </span>
                      <Badge variant="outline" className="rounded-full">
                        {resourceBlocks.length > 0 ? `${resourceBlocks.length}건` : '비어 있음'}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      {resourceBlocks.length > 0 ? resourceBlocks.map((block) => (
                        <div key={`${block.resourceId}-${block.startsAt}`} className="rounded-md border border-border bg-muted/20 px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold">{formatBlockTime(block)}</span>
                              {canShowPublicDetails && (
                                <span className="mt-1 block truncate text-xs font-medium text-foreground">
                                  {getBlockCompanyLabel(block)}
                                </span>
                              )}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn('rounded-full text-[11px]', block.status === 'pending_review' && 'border-dashed')}
                            >
                              {getStatusLabel(block.status)}
                            </Badge>
                          </div>
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {canShowPublicDetails ? getBlockPurposeLabel(block) : '점유 상태만 공개됩니다.'}
                          </p>
                        </div>
                      )) : (
                        <p className="rounded-md border border-dashed border-border bg-card px-3 py-3 text-sm text-muted-foreground">
                          선택한 날짜에 공개된 사용 구간이 없습니다.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold">예약 가능 시간</p>
                {isSlotsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              <div className="mt-3 max-h-80 space-y-2 overflow-auto pr-1">
                {selectedDateSlots.length > 0 ? selectedDateSlots.map((slot) => {
                  const key = getSlotKey(slot);
                  const selected = selectedSlotKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onSelectSlot(key)}
                      className={cn(
                        'w-full rounded-lg border px-3 py-3 text-left transition-colors',
                        selected
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border bg-background hover:border-foreground/30 hover:bg-muted/20',
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2 text-sm font-bold">
                          <Clock3 className="h-3.5 w-3.5" />
                          {slot.label}
                        </span>
                        {selected && <CheckCircle2 className="h-4 w-4" />}
                      </span>
                      <span className={cn('mt-1 block text-xs', selected ? 'text-background/70' : 'text-muted-foreground')}>
                        {slot.resourceName}
                      </span>
                    </button>
                  );
                }) : (
                  <div className="rounded-lg border border-dashed border-border bg-background p-4 text-center text-sm text-muted-foreground">
                    {isSlotsLoading ? '예약 가능 시간을 확인하고 있습니다.' : '선택한 날짜에 예약 가능한 시간이 없습니다.'}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
