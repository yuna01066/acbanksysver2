import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type {
  PublicBookingLinkPublic,
  PublicBookingScheduleBlock,
  PublicBookingScheduleView,
} from '@/types/publicBooking';

type PublicRoomScheduleViewerProps = {
  slug: string;
  link: PublicBookingLinkPublic;
  accessCode: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

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

function formatBlockTime(block: PublicBookingScheduleBlock) {
  const startsAt = new Date(block.startsAt);
  const endsAt = new Date(block.endsAt);
  return `${format(startsAt, 'HH:mm')} - ${format(endsAt, 'HH:mm')}`;
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

export function PublicRoomScheduleViewer({
  slug,
  link,
  accessCode,
  selectedDate,
  onSelectDate,
}: PublicRoomScheduleViewerProps) {
  const [view, setView] = useState<PublicBookingScheduleView>('month');
  const [anchorDate, setAnchorDate] = useState(() => parseDateKey(selectedDate));
  const [blocks, setBlocks] = useState<PublicBookingScheduleBlock[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const isLocked = link.requiresAccessCode && !accessCode.trim();

  useEffect(() => {
    const nextDate = parseDateKey(selectedDate);
    setAnchorDate((current) => (isSameDay(nextDate, current) ? current : nextDate));
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
            date: dateKey(anchorDate),
            accessCode,
          },
        });
        if (invokeError) throw invokeError;
        if (data?.error) throw new Error(String(data.error));
        if (mounted) setBlocks((data?.blocks || []) as PublicBookingScheduleBlock[]);
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
  }, [accessCode, anchorDate, isLocked, slug, view]);

  const blocksByDate = useMemo(() => {
    const grouped = new Map<string, PublicBookingScheduleBlock[]>();
    blocks.forEach((block) => {
      const key = format(new Date(block.startsAt), 'yyyy-MM-dd');
      const current = grouped.get(key) || [];
      current.push(block);
      grouped.set(key, current);
    });
    grouped.forEach((items) => items.sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    return grouped;
  }, [blocks]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(anchorDate), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [anchorDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(anchorDate, { weekStartsOn: 0 });
    const end = endOfWeek(anchorDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [anchorDate]);

  const timeRows = useMemo(() => {
    const start = clockToMinutes(link.rules.startTime);
    const end = clockToMinutes(link.rules.endTime);
    const rows: number[] = [];
    for (let cursor = start; cursor + link.rules.durationMinutes <= end; cursor += link.rules.slotMinutes) {
      rows.push(cursor);
    }
    return rows;
  }, [link.rules.durationMinutes, link.rules.endTime, link.rules.slotMinutes, link.rules.startTime]);

  const moveRange = (direction: -1 | 1) => {
    setAnchorDate((current) => {
      if (view === 'month') return direction > 0 ? addMonths(current, 1) : subMonths(current, 1);
      if (view === 'week') return direction > 0 ? addWeeks(current, 1) : subWeeks(current, 1);
      return addDays(current, direction);
    });
  };

  const selectDate = (date: Date, nextView?: PublicBookingScheduleView) => {
    setAnchorDate(date);
    onSelectDate(dateKey(date));
    if (nextView) setView(nextView);
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-none">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-bold">회의실 이용 시간표</h2>
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            내부 일정 상세는 숨기고 회의실 사용 여부만 표시합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['month', 'week', 'day'] as PublicBookingScheduleView[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={cn(
                'h-8 rounded-full border px-3 text-xs font-semibold transition-colors',
                view === item
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground',
              )}
            >
              {item === 'month' ? '월간' : item === 'week' ? '주간' : '일간'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => moveRange(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <button
          type="button"
          className="rounded-full border border-border bg-background px-4 py-2 text-sm font-bold"
          onClick={() => selectDate(new Date())}
        >
          {getRangeLabel(view, anchorDate)}
        </button>
        <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => moveRange(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isLocked ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
          접근 코드를 입력하면 회의실 이용 시간표를 볼 수 있습니다.
        </div>
      ) : error ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : view === 'month' ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center text-xs font-semibold text-muted-foreground">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-2">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((day) => {
              const key = dateKey(day);
              const dayBlocks = blocksByDate.get(key) || [];
              const selected = selectedDate === key;
              const visibleBlocks = dayBlocks.slice(0, 2);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectDate(day, 'day')}
                  className={cn(
                    'min-h-24 border-b border-r border-border bg-card p-2 text-left transition-colors hover:bg-muted/30',
                    !isSameMonth(day, anchorDate) && 'bg-muted/10 text-muted-foreground',
                    selected && 'bg-foreground/[0.04] ring-1 ring-inset ring-foreground',
                  )}
                >
                  <span className="text-sm font-bold">{format(day, 'd')}</span>
                  <div className="mt-2 space-y-1">
                    {visibleBlocks.map((block) => (
                      <span
                        key={`${block.resourceId}-${block.startsAt}`}
                        className="block truncate rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {format(new Date(block.startsAt), 'HH:mm')} {block.resourceName}
                      </span>
                    ))}
                    {dayBlocks.length > visibleBlocks.length && (
                      <span className="block text-[11px] font-semibold text-muted-foreground">
                        +{dayBlocks.length - visibleBlocks.length}건
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : view === 'week' ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-7">
          {weekDays.map((day) => {
            const key = dateKey(day);
            const dayBlocks = blocksByDate.get(key) || [];
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectDate(day, 'day')}
                className={cn(
                  'min-h-40 rounded-lg border border-border bg-background p-3 text-left transition-colors hover:border-foreground/30',
                  selectedDate === key && 'border-foreground',
                )}
              >
                <span className="text-xs font-semibold text-muted-foreground">{format(day, 'EEE', { locale: ko })}</span>
                <p className="mt-1 text-lg font-bold">{format(day, 'd')}</p>
                <div className="mt-3 space-y-2">
                  {dayBlocks.length > 0 ? dayBlocks.slice(0, 4).map((block) => (
                    <div key={`${block.resourceId}-${block.startsAt}`} className="rounded-md border border-border bg-muted/30 px-2 py-1">
                      <p className="truncate text-xs font-semibold">{block.resourceName}</p>
                      <p className="text-[11px] text-muted-foreground">{formatBlockTime(block)}</p>
                    </div>
                  )) : (
                    <p className="text-xs text-muted-foreground">예약 없음</p>
                  )}
                  {dayBlocks.length > 4 && (
                    <Badge variant="outline" className="rounded-full text-[11px]">+{dayBlocks.length - 4}건</Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 overflow-auto rounded-lg border border-border">
          <div
            className="grid min-w-[680px] border-b border-border bg-muted/30"
            style={{ gridTemplateColumns: `90px repeat(${Math.max(link.resources.length, 1)}, minmax(150px, 1fr))` }}
          >
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">시간</div>
            {link.resources.map((resource) => (
              <div key={resource.id} className="border-l border-border px-3 py-2 text-xs font-bold">
                {resource.name}
              </div>
            ))}
          </div>
          {timeRows.map((startMinutes) => {
            const currentDate = dateKey(anchorDate);
            const { startsAt, endsAt } = slotRange(currentDate, startMinutes, link.rules.durationMinutes);
            return (
              <div
                key={startMinutes}
                className="grid min-w-[680px] border-b border-border last:border-b-0"
                style={{ gridTemplateColumns: `90px repeat(${Math.max(link.resources.length, 1)}, minmax(150px, 1fr))` }}
              >
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">{minutesToClock(startMinutes)}</div>
                {link.resources.map((resource) => {
                  const busyBlock = blocks.find((block) => block.resourceId === resource.id && overlaps(block, startsAt, endsAt));
                  return (
                    <button
                      key={`${resource.id}-${startMinutes}`}
                      type="button"
                      onClick={() => !busyBlock && onSelectDate(currentDate)}
                      className={cn(
                        'border-l border-border px-3 py-2 text-left text-xs transition-colors',
                        busyBlock
                          ? 'bg-muted/50 text-muted-foreground'
                          : 'bg-card text-foreground hover:bg-muted/20',
                      )}
                    >
                      {busyBlock ? (
                        <>
                          <span className="font-bold">사용 중</span>
                          <span className="mt-0.5 block text-[11px]">{formatBlockTime(busyBlock)}</span>
                        </>
                      ) : (
                        <span className="font-semibold">예약 가능</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-foreground" />
          사용 중
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full border border-border bg-card" />
          예약 가능
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3 w-3" />
          날짜를 선택하면 아래 예약 가능 시간이 갱신됩니다.
        </span>
      </div>
    </section>
  );
}
