import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sun, Moon, Coffee, Utensils, Clock, Calendar, MapPin, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

type WorkStatus = 'available' | 'busy' | 'focusing' | 'meeting';

const STATUS_CONFIG: Record<WorkStatus, { label: string; emoji: string; dotColor: string; borderColor: string }> = {
  available: { label: '여유', emoji: '🟢', dotColor: 'bg-green-500', borderColor: 'border-green-300 dark:border-green-700' },
  busy: { label: '바쁨', emoji: '🔴', dotColor: 'bg-red-500', borderColor: 'border-red-300 dark:border-red-700' },
  focusing: { label: '집중 중', emoji: '🟡', dotColor: 'bg-yellow-500', borderColor: 'border-yellow-300 dark:border-yellow-700' },
  meeting: { label: '미팅 중', emoji: '🟣', dotColor: 'bg-purple-500', borderColor: 'border-purple-300 dark:border-purple-700' },
};

interface TimeGreetingProps {
  name: string;
  avatarUrl?: string | null;
}

const getGreetingData = (): { message: string; icon: React.ReactNode; sub?: string; gradient: string; iconBg: string; timeColor: string } => {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  if (h === 11 && m >= 30) {
    return { message: '점심시간이 얼마 남지 않았어요!', icon: <Utensils className="h-5 w-5 text-orange-600" />, sub: '맛있는 점심 기대하세요 🍽️', gradient: 'from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-yellow-950/20', iconBg: 'bg-orange-100 dark:bg-orange-900/40', timeColor: 'text-orange-700 dark:text-orange-300' };
  }
  if (h === 12) {
    return { message: '점심시간입니다!', icon: <Utensils className="h-5 w-5 text-orange-600" />, sub: '맛있는 식사 하세요 🍚', gradient: 'from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-yellow-950/20', iconBg: 'bg-orange-100 dark:bg-orange-900/40', timeColor: 'text-orange-700 dark:text-orange-300' };
  }
  if (h === 17 && m >= 30) {
    return { message: '퇴근시간이 얼마 남지 않았어요!', icon: <Clock className="h-5 w-5 text-emerald-600" />, sub: '오늘도 수고하셨습니다 🎉', gradient: 'from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950/40 dark:via-green-950/30 dark:to-teal-950/20', iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', timeColor: 'text-emerald-700 dark:text-emerald-300' };
  }
  if (h >= 5 && h < 12) {
    return { message: '좋은 아침입니다.', icon: <Sun className="h-5 w-5 text-amber-500" />, sub: '오늘도 화이팅! ☀️', gradient: 'from-sky-50 via-amber-50/60 to-orange-50/40 dark:from-sky-950/40 dark:via-amber-950/20 dark:to-orange-950/10', iconBg: 'bg-amber-100 dark:bg-amber-900/40', timeColor: 'text-sky-700 dark:text-sky-300' };
  }
  if (h >= 12 && h < 18) {
    return { message: '좋은 오후입니다.', icon: <Coffee className="h-5 w-5 text-blue-500" />, sub: '남은 오후도 힘내세요 💪', gradient: 'from-blue-50 via-sky-50 to-cyan-50/60 dark:from-blue-950/40 dark:via-sky-950/30 dark:to-cyan-950/20', iconBg: 'bg-blue-100 dark:bg-blue-900/40', timeColor: 'text-blue-700 dark:text-blue-300' };
  }
  return { message: '좋은 저녁입니다.', icon: <Moon className="h-5 w-5 text-indigo-400" />, sub: '오늘 하루도 수고하셨어요 🌙', gradient: 'from-indigo-50 via-violet-50/60 to-slate-100 dark:from-indigo-950/50 dark:via-violet-950/30 dark:to-slate-900/40', iconBg: 'bg-indigo-100 dark:bg-indigo-900/40', timeColor: 'text-indigo-700 dark:text-indigo-300' };
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
};

const formatDate = (date: Date) => {
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
};

const TimeGreeting: React.FC<TimeGreetingProps> = ({ name, avatarUrl }) => {
  const { user } = useAuth();
  const [greeting, setGreeting] = useState(getGreetingData());
  const [now, setNow] = useState(new Date());
  const [myStatus, setMyStatus] = useState<WorkStatus>('available');
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);

  // Fetch today's upcoming events (conference, meeting, event)
  const { data: todayEvents } = useQuery({
    queryKey: ['today-upcoming-events'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('announcements')
        .select('id, title, announcement_type, meeting_date, meeting_time, meeting_location, content, author_name')
        .in('announcement_type', ['meeting', 'conference', 'event'])
        .or(`meeting_date.eq.${today},and(meeting_date.lte.${today},event_end_date.gte.${today})`)
        .order('meeting_time', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  // Filter upcoming events within 30 minutes
  const upcomingEvents = useMemo(() => {
    if (!todayEvents || todayEvents.length === 0) return [];
    const nowDate = new Date();
    const currentMinute = nowDate.getHours() * 60 + nowDate.getMinutes();

    return todayEvents
      .map(ev => {
        if (!ev.meeting_time) {
          // Events without time - show all day
          return { ...ev, minutesLeft: null, isAllDay: true };
        }
        const [h, min] = ev.meeting_time.split(':').map(Number);
        if (isNaN(h) || isNaN(min)) return null;
        const eventMin = h * 60 + min;
        const diff = eventMin - currentMinute;
        if (diff > 0 && diff <= 30) {
          return { ...ev, minutesLeft: diff, isAllDay: false };
        }
        return null;
      })
      .filter(Boolean)
      .slice(0, 3) as Array<{
        id: string; title: string; announcement_type: string;
        meeting_date: string | null; meeting_time: string | null;
        meeting_location: string | null; content: string;
        author_name: string; minutesLeft: number | null; isAllDay: boolean;
      }>;
  }, [todayEvents, now]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
      setGreeting(getGreetingData());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync with presence channel
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('employee-status', {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const myPresences = state[user.id];
        if (myPresences && myPresences.length > 0) {
          const latest = myPresences[myPresences.length - 1] as any;
          if (latest?.status) setMyStatus(latest.status as WorkStatus);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ status: myStatus, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const updateMyStatus = useCallback(async (newStatus: WorkStatus) => {
    setMyStatus(newStatus);
    setStatusPopoverOpen(false);

    const channel = supabase.channel('employee-status');
    await channel.track({ status: newStatus, online_at: new Date().toISOString() });
    toast.success(`상태가 "${STATUS_CONFIG[newStatus].label}"(으)로 변경되었습니다`);
  }, []);

  const statusCfg = STATUS_CONFIG[myStatus];

  // Work progress calculation (9:00 ~ 18:00)
  const workStart = 9 * 60; // 540 min
  const workEnd = 18 * 60; // 1080 min
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const isWorkTime = currentMin >= workStart && currentMin <= workEnd;
  const workProgress = isWorkTime
    ? Math.min(100, Math.max(0, ((currentMin - workStart) / (workEnd - workStart)) * 100))
    : currentMin < workStart ? 0 : 100;
  const remainingMin = isWorkTime ? workEnd - currentMin : currentMin < workStart ? workEnd - workStart : 0;
  const remainingHours = Math.floor(remainingMin / 60);
  const remainingMins = remainingMin % 60;
  const elapsedMin = Math.max(0, Math.min(currentMin - workStart, workEnd - workStart));
  const elapsedHours = Math.floor(elapsedMin / 60);
  const elapsedMins = elapsedMin % 60;

  // Runner emoji based on progress
  const getRunnerEmoji = () => {
    if (workProgress >= 100) return '🎉';
    if (workProgress >= 75) return '🏃';
    if (workProgress >= 50) return '🚶';
    if (workProgress >= 25) return '☕';
    return '🌅';
  };

  return (
    <div className={`animate-fade-in glass-card p-4 sm:p-5 bg-gradient-to-r ${greeting.gradient} transition-colors duration-1000`}>
      {/* Mobile: stacked layout, Desktop: side-by-side */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
              <PopoverTrigger asChild>
                <Avatar className={`h-16 w-16 sm:h-[100px] sm:w-[100px] shrink-0 rounded-lg border-2 ${statusCfg.borderColor} shadow-sm cursor-pointer transition-transform hover:scale-105`}>
                  <AvatarImage src={avatarUrl || undefined} alt={name} className="object-cover" />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl sm:text-2xl font-semibold">
                    {name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1.5" side="bottom" align="start">
                <p className="text-[10px] font-medium text-muted-foreground px-2 py-1">내 상태 변경</p>
                {(Object.entries(STATUS_CONFIG) as [WorkStatus, typeof STATUS_CONFIG[WorkStatus]][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => updateMyStatus(key)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                      myStatus === key ? 'bg-accent font-medium' : 'hover:bg-muted'
                    }`}
                  >
                    <span>{cfg.emoji}</span>
                    <span>{cfg.label}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-full ${statusCfg.dotColor} border-2 border-background`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <div className={`animate-scale-in flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full ${greeting.iconBg} transition-colors duration-1000 shrink-0`}>
                {greeting.icon}
              </div>
              <p className="text-base sm:text-lg font-semibold text-foreground leading-tight">
                {name} 님, {greeting.message}
              </p>
            </div>
            {greeting.sub && (
              <p className="text-xs sm:text-sm text-muted-foreground ml-10 sm:ml-12">{greeting.sub}</p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 flex sm:block items-center justify-end gap-2 sm:gap-0">
          <p className={`text-xl sm:text-2xl font-bold tabular-nums tracking-tight ${greeting.timeColor} transition-colors duration-1000`}>
            {formatTime(now)}
          </p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            {formatDate(now)}
          </p>
        </div>
      </div>

      {/* Work Progress Bar */}
      <div className="mt-4 pt-3 border-t border-border/40">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">오늘의 근무 진행률</span>
            <span className="text-base leading-none">{getRunnerEmoji()}</span>
          </div>
          <span className="text-xs font-bold text-foreground tabular-nums">{Math.round(workProgress)}%</span>
        </div>

        {/* Progress track */}
        <div className="relative h-5 rounded-full bg-muted/60 overflow-hidden shadow-inner">
          {/* Filled portion */}
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${workProgress}%`,
              background: workProgress >= 100
                ? 'linear-gradient(90deg, #10b981, #34d399, #6ee7b7)'
                : 'linear-gradient(90deg, #60a5fa, #818cf8, #a78bfa)',
            }}
          />
          {/* Runner icon on the progress edge */}
          {workProgress > 0 && workProgress < 100 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000 ease-out"
              style={{ left: `calc(${workProgress}% - 10px)` }}
            >
              <span className="text-sm drop-shadow-sm animate-bounce" style={{ animationDuration: '2s' }}>
                {getRunnerEmoji()}
              </span>
            </div>
          )}
          {workProgress >= 100 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white drop-shadow-sm">퇴근!</span>
            </div>
          )}
        </div>

        {/* Time markers */}
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground font-medium">09:00</span>
          <span className="text-[10px] text-muted-foreground font-medium">12:00</span>
          <span className="text-[10px] text-muted-foreground font-medium">15:00</span>
          <span className="text-[10px] text-muted-foreground font-medium">18:00</span>
        </div>

        {/* Elapsed / Remaining info */}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] text-muted-foreground">
            ⏱️ 경과 <span className="font-semibold text-foreground">{elapsedHours}시간 {elapsedMins}분</span>
          </span>
          <span className="text-[11px] text-muted-foreground">
            ⏳ 남은 시간 <span className="font-semibold text-foreground">{remainingHours}시간 {remainingMins}분</span>
          </span>
        </div>
      </div>

      {/* Upcoming event reminders - separate cards */}
      {upcomingEvents.length > 0 && (
        <div className={`mt-3 grid gap-2.5 ${upcomingEvents.length === 1 ? 'grid-cols-1' : upcomingEvents.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
          {upcomingEvents.map((ev) => {
            const typeConfig = {
              conference: { label: '회의', badgeBg: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300', cardBorder: 'border-violet-200 dark:border-violet-800', cardBg: 'bg-violet-50/80 dark:bg-violet-950/30', icon: <Users className="h-3.5 w-3.5" /> },
              meeting: { label: '미팅', badgeBg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300', cardBorder: 'border-amber-200 dark:border-amber-800', cardBg: 'bg-amber-50/80 dark:bg-amber-950/30', icon: <Coffee className="h-3.5 w-3.5" /> },
              event: { label: '이벤트', badgeBg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300', cardBorder: 'border-emerald-200 dark:border-emerald-800', cardBg: 'bg-emerald-50/80 dark:bg-emerald-950/30', icon: <Calendar className="h-3.5 w-3.5" /> },
            }[ev.announcement_type] || { label: '일정', badgeBg: 'bg-muted text-muted-foreground', cardBorder: 'border-border', cardBg: 'bg-muted/50', icon: <Calendar className="h-3.5 w-3.5" /> };

            const formattedDate = ev.meeting_date
              ? new Date(ev.meeting_date + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' })
              : null;

            return (
              <div key={ev.id} className={`rounded-xl border ${typeConfig.cardBorder} ${typeConfig.cardBg} p-3 space-y-1.5`}>
                {/* Header: badge + minutes */}
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeConfig.badgeBg}`}>
                    {typeConfig.icon}
                    {typeConfig.label}
                  </span>
                  {ev.minutesLeft && (
                    <span className="text-[10px] font-medium text-muted-foreground">{ev.minutesLeft}분 전</span>
                  )}
                </div>
                {/* Title */}
                <p className="text-sm font-semibold text-foreground leading-snug truncate">{ev.title}</p>
                {/* Date / Time / Location */}
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
                  {formattedDate && (
                    <span className="flex items-center gap-0.5">
                      <Calendar className="h-3 w-3 shrink-0" />
                      {formattedDate}
                    </span>
                  )}
                  {ev.meeting_time && (
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-3 w-3 shrink-0" />
                      {ev.meeting_time}
                    </span>
                  )}
                  {ev.meeting_location && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-3 w-3 shrink-0 text-red-400" />
                      {ev.meeting_location}
                    </span>
                  )}
                </div>
                {/* Author */}
                <p className="text-[10px] text-muted-foreground/70">{ev.author_name}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TimeGreeting;
