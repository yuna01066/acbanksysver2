import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type ScheduleView = 'month' | 'week' | 'day';

type ScheduleBlockStatus = 'confirmed' | 'pending_review';
type ScheduleBlockSource = 'calendar_event' | 'public_request';

type ScheduleBlock = {
  id: string;
  /** @deprecated use status */
  kind?: 'confirmed' | 'pending';
  status?: ScheduleBlockStatus;
  source?: ScheduleBlockSource;
  resourceId: string | null;
  resourceName: string;
  date: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  time: string;
  label: string;
  sourceType: string | null;
  /** Coarse public context, only for links with public schedule details enabled. */
  publicCompanyName?: string | null;
  publicPurpose?: string | null;
};


type ScheduleResource = { id: string; name: string; floor: string | null };

type ScheduleRules = {
  allowedWeekdays?: number[];
  startTime?: string;
  endTime?: string;
  slotMinutes?: number;
  durationMinutes?: number;
  minNoticeMinutes?: number;

};

type ScheduleResponse = {
  view: ScheduleView;
  range: { startDate: string; endDate: string; startsAt: string; endsAt: string };
  resources: ScheduleResource[];
  rules?: ScheduleRules;
  blocks: ScheduleBlock[];
  cached?: boolean;
  cachedAt?: string | null;
};

const VIEW_OPTIONS: { value: ScheduleView; label: string }[] = [
  { value: 'month', label: '월간' },
  { value: 'week', label: '주간' },
  { value: 'day', label: '일간' },
];

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

const STATUS_META: Record<ScheduleBlockStatus, { label: string; variant: 'secondary' | 'outline'; dot: string }> = {
  confirmed: { label: '확정', variant: 'secondary', dot: 'bg-primary' },
  pending_review: { label: '승인 대기', variant: 'outline', dot: 'bg-amber-500' },
};

function resolveStatus(block: ScheduleBlock): ScheduleBlockStatus {
  if (block.status === 'confirmed' || block.status === 'pending_review') return block.status;
  return block.kind === 'pending' ? 'pending_review' : 'confirmed';
}

function toDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+09:00`);
}

function dateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function weekdayIndex(dateKeyValue: string) {
  const [year, month, day] = dateKeyValue.split('-').map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1)).getUTCDay();
}

function resourceLabel(resource: ScheduleResource) {
  if (resource.floor && !resource.name.includes(resource.floor)) return `${resource.floor} ${resource.name}`;
  return resource.name;
}

function formatDayLabel(value: string) {
  return toDate(value).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'Asia/Seoul',
  });
}

function formatRangeLabel(response: ScheduleResponse | null) {
  if (!response) return '';
  const { startDate, endDate } = response.range;
  if (response.view === 'day') return formatDayLabel(startDate);
  return `${formatDayLabel(startDate)} ~ ${formatDayLabel(endDate)}`;
}

function minutesFromClock(clock: string) {
  const [hour, minute] = clock.split(':').map((part) => Number(part) || 0);
  return hour * 60 + minute;
}

function clockFromMinutes(total: number) {
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function seoulClock(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  }).format(new Date(iso));
}

function buildMonthCells(startDate: string, endDate: string) {
  const start = toDate(startDate);
  const end = toDate(endDate);
  const leading = weekdayIndex(startDate);
  const cells: { key: string; inRange: boolean }[] = [];
  let cursor = addDays(start, -leading);
  while (cursor <= end || cells.length % 7 !== 0) {
    const key = dateKey(cursor);
    cells.push({ key, inRange: key >= startDate && key <= endDate });
    cursor = addDays(cursor, 1);
    if (cells.length > 42) break;
  }
  return cells;
}

type Props = {
  slug: string;
  date: string;
  accessCode?: string;
  className?: string;
  /** Change this value to force a schedule refetch (e.g. after a booking request). */
  refreshToken?: string | number;
  /** Called when a visitor picks an open slot from the calendar detail panel. */
  onSelectSlot?: (date: string, resourceId: string | null, time: string) => void;
};

const PublicRoomScheduleViewer = ({ slug, date, accessCode, className, refreshToken, onSelectSlot }: Props) => {

  const [view, setView] = useState<ScheduleView>('month');
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedDate, setSelectedDate] = useState(date);
  const [openDetailDate, setOpenDetailDate] = useState<string | null>(null);


  useEffect(() => {
    setSelectedDate(date);
  }, [date]);

  useEffect(() => {
    let canceled = false;

    const load = async () => {
      if (!slug || !date) return;
      setIsLoading(true);
      setError('');
      try {
        const { data, error: invokeError } = await supabase.functions.invoke('public-meeting-booking', {
          body: {
            action: 'get-schedule',
            slug,
            view,
            date,
            accessCode: accessCode?.trim() || undefined,
          },
        });
        if (invokeError) throw invokeError;
        if (data?.error) throw new Error(String(data.error));
        if (!canceled) setSchedule(data as ScheduleResponse);
      } catch (err) {
        if (!canceled) {
          setSchedule(null);
          setError(err instanceof Error ? err.message : '시간표를 불러오지 못했습니다.');
        }
      } finally {
        if (!canceled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      canceled = true;
    };
  }, [slug, view, date, accessCode, reloadKey, refreshToken]);

  const blocksByDate = useMemo(() => {
    const map = new Map<string, ScheduleBlock[]>();
    for (const block of schedule?.blocks || []) {
      const list = map.get(block.date) || [];
      list.push(block);
      map.set(block.date, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return map;
  }, [schedule]);

  const statusCounts = useMemo(() => {
    const counts = { confirmed: 0, pending_review: 0 };
    for (const block of schedule?.blocks || []) counts[resolveStatus(block)] += 1;
    return counts;
  }, [schedule]);

  const cells = useMemo(() => {
    if (!schedule) return [];
    if (view === 'month') return buildMonthCells(schedule.range.startDate, schedule.range.endDate);
    const cellList: { key: string; inRange: boolean }[] = [];
    let cursor = toDate(schedule.range.startDate);
    const end = toDate(schedule.range.endDate);
    while (cursor <= end) {
      cellList.push({ key: dateKey(cursor), inRange: true });
      cursor = addDays(cursor, 1);
    }
    return cellList;
  }, [schedule, view]);

  const activeDate = useMemo(() => {
    if (!schedule) return selectedDate;
    if (selectedDate >= schedule.range.startDate && selectedDate <= schedule.range.endDate) return selectedDate;
    return schedule.range.startDate;
  }, [schedule, selectedDate]);

  const resources = schedule?.resources || [];
  const rules = schedule?.rules;

  const dayDetail = useMemo(() => {
    const dayBlocks = blocksByDate.get(activeDate) || [];
    const slotMinutes = rules?.slotMinutes && rules.slotMinutes > 0 ? rules.slotMinutes : 60;
    const duration = rules?.durationMinutes && rules.durationMinutes > 0 ? rules.durationMinutes : slotMinutes;
    const open = rules?.startTime ? minutesFromClock(rules.startTime) : 9 * 60;
    const close = rules?.endTime ? minutesFromClock(rules.endTime) : 18 * 60;
    const weekdayAllowed = !rules?.allowedWeekdays?.length
      ? true
      : rules.allowedWeekdays.includes(weekdayIndex(activeDate));

    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date());
    const pick = (type: string) => parts.find((part) => part.type === type)?.value || '00';
    const todayKey = `${pick('year')}-${pick('month')}-${pick('day')}`;
    const nowMinutes = Number(pick('hour')) * 60 + Number(pick('minute'));
    const minNotice = rules?.minNoticeMinutes && rules.minNoticeMinutes > 0 ? rules.minNoticeMinutes : 0;
    const earliestToday = activeDate === todayKey ? nowMinutes + minNotice : -1;
    const isPastDate = activeDate < todayKey;

    return resources.map((resource) => {
      const used = dayBlocks.filter((block) => block.resourceId === resource.id);
      const busy = used.map((block) => ({
        start: block.allDay ? open : minutesFromClock(seoulClock(block.startsAt)),
        end: block.allDay ? close : minutesFromClock(seoulClock(block.endsAt)),
      }));
      const available: { start: string; label: string }[] = [];
      if (weekdayAllowed && !isPastDate) {
        for (let start = open; start + duration <= close; start += slotMinutes) {
          const end = start + duration;
          if (start < earliestToday) continue;
          const overlaps = busy.some((item) => start < item.end && end > item.start);
          if (!overlaps) available.push({ start: clockFromMinutes(start), label: `${clockFromMinutes(start)}~${clockFromMinutes(end)}` });

        }
      }
      return { resource, used, available, weekdayAllowed, isPastDate };
    });
  }, [blocksByDate, activeDate, resources, rules]);


  return (
    <section className={cn('rounded-lg border border-border bg-card p-5', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
            <CalendarRange className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold leading-tight">회의실 이용 시간표</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatRangeLabel(schedule) || '기간을 불러오는 중입니다.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-border bg-muted/40 p-1">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setView(option.value)}
                className={cn(
                  'rounded-full px-3 py-1 text-sm transition-colors',
                  view === option.value ? 'bg-background font-semibold shadow-sm' : 'text-muted-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => setReloadKey((value) => value + 1)}
            aria-label="시간표 새로고침"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {error ? (
        <Alert variant="destructive" className="mt-4 rounded-lg">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="rounded-full">확정 {statusCounts.confirmed}</Badge>
        <Badge variant="outline" className="rounded-full">승인 대기 {statusCounts.pending_review}</Badge>
        <span>승인 대기 예약은 관리자가 승인하면 확정으로 바뀝니다.</span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label} className="py-1">{label}</span>
            ))}
          </div>
          <div className={cn('mt-1 grid gap-1', view === 'day' ? 'grid-cols-1' : 'grid-cols-7')}>
            {cells.map((cell) => {
              const dayBlocks = blocksByDate.get(cell.key) || [];
              const isActive = cell.key === activeDate;
              return (
                <Popover
                  key={cell.key}
                  open={openDetailDate === cell.key}
                  onOpenChange={(open) => setOpenDetailDate(open ? cell.key : null)}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(cell.key);
                        setOpenDetailDate(cell.key);
                      }}
                      className={cn(
                        'flex min-h-[64px] flex-col items-start gap-1 rounded-md border p-1.5 text-left transition-colors',
                        cell.inRange ? 'border-border bg-card hover:bg-muted/40' : 'border-transparent bg-muted/10 text-muted-foreground/50',
                        isActive && 'border-primary ring-1 ring-primary',
                      )}
                    >
                      <span className="text-xs font-semibold">{Number(cell.key.slice(8, 10))}</span>
                      <span className="flex flex-wrap gap-1">
                        {resources.map((resource) => {
                          const resourceBlocks = dayBlocks.filter((block) => block.resourceId === resource.id);
                          if (resourceBlocks.length === 0) return null;
                          const status = resolveStatus(resourceBlocks[0]);
                          return (
                            <span key={resource.id} className="flex">
                              <span className={cn('h-2 w-2 rounded-full', STATUS_META[status].dot)} />
                            </span>
                          );
                        })}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 p-3">
                    <p className="text-sm font-semibold">{formatDayLabel(cell.key)}</p>
                    {dayBlocks.length === 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">등록된 일정이 없습니다.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {dayBlocks.map((block) => (
                          <li key={block.id} className="border-t border-border/60 pt-2 first:border-t-0 first:pt-0">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-medium">{block.resourceName}</span>
                              <Badge variant={STATUS_META[resolveStatus(block)].variant} className="rounded-full">
                                {STATUS_META[resolveStatus(block)].label}
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {block.allDay ? '종일' : `${seoulClock(block.startsAt)}~${seoulClock(block.endsAt)}`}
                            </p>
                            {block.publicCompanyName || block.publicPurpose ? (
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {[block.publicCompanyName, block.publicPurpose ? `용무: ${block.publicPurpose}` : null]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            ) : (
                              <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                                공개 회사명/용무가 입력되지 않았습니다.
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      onClick={() => setOpenDetailDate(null)}
                      className="mt-3 text-[11px] font-medium text-primary underline-offset-2 hover:underline"
                    >
                      우측 시간표 보기
                    </button>
                  </PopoverContent>
                </Popover>
              );
            })}

          </div>
          {resources.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {resources.map((resource) => (
                <span key={resource.id} className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  {resourceLabel(resource)}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-sm font-semibold">{formatDayLabel(activeDate)} 회의실 현황</p>
          <div className="mt-3 space-y-3">
            {dayDetail.length === 0 ? (
              <p className="text-sm text-muted-foreground">표시할 회의실 정보가 없습니다.</p>
            ) : null}
            {dayDetail.map(({ resource, used, available, weekdayAllowed, isPastDate }) => (
              <div key={resource.id} className="rounded-lg border border-border bg-background p-3">
                <p className="text-sm font-medium">
                  {resourceLabel(resource)}
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">사용 구간</p>
                  {used.length === 0 ? (
                    <p className="text-xs text-muted-foreground">등록된 일정이 없습니다.</p>
                  ) : (
                    <ul className="space-y-1">
                      {used.map((block) => (
                        <li key={block.id} className="text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span>{block.allDay ? '종일' : `${seoulClock(block.startsAt)}~${seoulClock(block.endsAt)}`}</span>
                            <Badge variant={STATUS_META[resolveStatus(block)].variant} className="rounded-full">
                              {STATUS_META[resolveStatus(block)].label}
                            </Badge>
                          </div>
                          {block.publicCompanyName || block.publicPurpose ? (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {[block.publicCompanyName, block.publicPurpose ? `용무: ${block.publicPurpose}` : null]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          ) : null}
                        </li>
                      ))}

                    </ul>
                  )}
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">예약 가능 시간</p>
                  {!weekdayAllowed ? (
                    <p className="text-xs text-muted-foreground">예약 불가한 요일입니다.</p>
                  ) : isPastDate ? (
                    <p className="text-xs text-muted-foreground">지난 날짜는 예약할 수 없습니다.</p>
                  ) : available.length === 0 ? (
                    <p className="text-xs text-muted-foreground">남은 시간이 없습니다.</p>

                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {available.map((slot) => (
                        <button
                          key={slot.start}
                          type="button"
                          onClick={() => onSelectSlot?.(activeDate, resource.id, slot.start)}
                          className="rounded-full border border-border px-2 py-0.5 text-xs transition-colors hover:border-foreground hover:bg-muted"
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>

                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PublicRoomScheduleViewer;
