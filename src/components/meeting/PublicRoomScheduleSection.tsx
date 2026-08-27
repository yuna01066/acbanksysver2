import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type ScheduleView = 'month' | 'week' | 'day';

type ScheduleBlock = {
  id: string;
  kind: 'confirmed' | 'pending';
  resourceId: string | null;
  resourceName: string;
  date: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  time: string;
  label: string;
  sourceType: string | null;
};

type ScheduleResponse = {
  view: ScheduleView;
  range: { startDate: string; endDate: string; startsAt: string; endsAt: string };
  resources: { id: string; name: string; floor: string | null }[];
  blocks: ScheduleBlock[];
  cached?: boolean;
  cachedAt?: string | null;
};

const VIEW_OPTIONS: { value: ScheduleView; label: string }[] = [
  { value: 'month', label: '월간' },
  { value: 'week', label: '주간' },
  { value: 'day', label: '일간' },
];

function formatDayLabel(date: string) {
  const value = new Date(`${date}T00:00:00+09:00`);
  return value.toLocaleDateString('ko-KR', {
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

type Props = {
  slug: string;
  date: string;
  accessCode?: string;
  className?: string;
};

const PublicRoomScheduleSection = ({ slug, date, accessCode, className }: Props) => {
  const [view, setView] = useState<ScheduleView>('month');
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [slug, view, date, accessCode, reloadKey]);

  const grouped = useMemo(() => {
    const map = new Map<string, ScheduleBlock[]>();
    for (const block of schedule?.blocks || []) {
      const list = map.get(block.date) || [];
      list.push(block);
      map.set(block.date, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [schedule]);

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

      <div className="mt-4 space-y-3">
        {grouped.length === 0 && !isLoading && !error ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            해당 기간에 등록된 회의실 일정이 없습니다.
          </p>
        ) : null}

        {grouped.map(([day, blocks]) => (
          <div key={day} className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-sm font-semibold">{formatDayLabel(day)}</p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {blocks.map((block) => (
                <li
                  key={block.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{block.allDay ? '종일' : block.time}</span>
                    <span className="ml-2 truncate text-muted-foreground">{block.resourceName}</span>
                  </span>
                  <Badge variant={block.kind === 'confirmed' ? 'secondary' : 'outline'} className="rounded-full">
                    {block.kind === 'confirmed' ? '확정' : '대기'}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
};

export default PublicRoomScheduleSection;
