import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Sun, Moon, Coffee, Utensils, Clock, Calendar, MapPin, Users, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { isMissingMeetingReservationsTableError } from '@/lib/meetingReservationErrors';
import { triggerDailyHamzzi } from '@/lib/hamzziEvents';
import { cn } from '@/lib/utils';

type WorkStatus = 'available' | 'busy' | 'focusing' | 'meeting';

const STATUS_CONFIG: Record<WorkStatus, { label: string; dotColor: string }> = {
  available: { label: '여유', dotColor: 'bg-green-500' },
  busy: { label: '바쁨', dotColor: 'bg-red-500' },
  focusing: { label: '집중 중', dotColor: 'bg-yellow-500' },
  meeting: { label: '미팅 중', dotColor: 'bg-purple-500' },
};

interface TimeGreetingProps {
  name: string;
  avatarUrl?: string | null;
  attendanceAction?: React.ReactNode;
}

const supabaseAny = supabase as any;

const getGreetingData = (): { message: string; icon: React.ReactNode; sub?: string } => {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  if (h === 11 && m >= 30) {
    return { message: '점심시간이 얼마 남지 않았어요.', icon: <Utensils className="h-5 w-5" />, sub: '잠시 쉬어갈 준비를 해주세요.' };
  }
  if (h === 12) {
    return { message: '점심시간입니다.', icon: <Utensils className="h-5 w-5" />, sub: '오후 업무 전 잠시 재정비하세요.' };
  }
  if (h === 17 && m >= 30) {
    return { message: '퇴근시간이 얼마 남지 않았어요.', icon: <Clock className="h-5 w-5" />, sub: '마감할 업무를 정리해 주세요.' };
  }
  if (h >= 5 && h < 12) {
    return { message: '좋은 아침입니다.', icon: <Sun className="h-5 w-5" />, sub: '오늘의 주요 업무를 확인해 주세요.' };
  }
  if (h >= 12 && h < 18) {
    return { message: '좋은 오후입니다.', icon: <Coffee className="h-5 w-5" />, sub: '남은 일정과 납기 항목을 확인해 주세요.' };
  }
  return { message: '좋은 저녁입니다.', icon: <Moon className="h-5 w-5" />, sub: '마무리할 업무가 있는지 확인해 주세요.' };
};

// 🎯 시크릿 이벤트 시스템
type SecretEvent = {
  emoji: string;
  message: string;
  sub: string;
  particles?: string[];
  sound?: { freq: number; type: OscillatorType };
};

const getSecretEvent = (name: string): SecretEvent | null => {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const day = now.getDay(); // 0=일 ~ 6=토
  const date = now.getDate();
  const month = now.getMonth() + 1;

  // 자정 (00:00 ~ 00:05) – 새로운 하루
  if (h === 0 && m < 5) {
    return {
      emoji: '🌠',
      message: '새로운 하루가 시작됩니다!',
      sub: `${name}님, 별이 빛나는 밤에 새 하루를 맞이하세요 ✨`,
      particles: ['⭐', '✨', '🌟', '💫', '🌙'],
    };
  }

  // 새벽 2~4시 – 밤올빼미
  if (h >= 2 && h < 4) {
    return {
      emoji: '🦉',
      message: '밤올빼미 모드 활성화!',
      sub: `이 시간에 일하는 ${name}님은 진정한 야행성... 건강 조심하세요 🌙`,
      particles: ['🦉', '🌙', '⭐', '🌟'],
    };
  }

  // 금요일 17:30 이후 – 불금
  if (day === 5 && (h > 17 || (h === 17 && m >= 30))) {
    return {
      emoji: '🎉',
      message: '불금이다! 🔥',
      sub: `${name}님, 한 주 고생하셨습니다! 즐거운 주말 보내세요 🥳`,
      particles: ['🎊', '🎉', '🥳', '🔥', '💃'],
      sound: { freq: 523, type: 'triangle' as OscillatorType },
    };
  }

  // 월요일 아침 (9:00 ~ 9:30) – 월요병
  if (day === 1 && h === 9 && m < 30) {
    return {
      emoji: '💪',
      message: '월요일도 힘내봅시다!',
      sub: `새로운 한 주가 시작됐어요. ${name}님 파이팅! ☕`,
      particles: ['💪', '☕', '🚀'],
    };
  }

  // 매월 1일 – 새로운 달
  if (date === 1 && h >= 9 && h < 12) {
    const monthNames = ['', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    return {
      emoji: '📅',
      message: `${monthNames[month]}의 시작!`,
      sub: `새로운 달, 새로운 시작! ${name}님의 ${monthNames[month]}도 응원합니다 🎯`,
      particles: ['🎯', '📅', '🌱', '✨'],
    };
  }

  // 크리스마스 (12/25)
  if (month === 12 && date === 25) {
    return {
      emoji: '🎄',
      message: '메리 크리스마스! 🎅',
      sub: `${name}님, 행복한 크리스마스 보내세요!`,
      particles: ['🎄', '🎅', '🎁', '⛄', '❄️', '🌟'],
    };
  }

  // 새해 (1/1)
  if (month === 1 && date === 1) {
    return {
      emoji: '🎆',
      message: '새해 복 많이 받으세요!',
      sub: `${name}님, ${now.getFullYear()}년도 좋은 일만 가득하길! 🎊`,
      particles: ['🎆', '🎇', '🎊', '🎉', '✨', '🥂'],
      sound: { freq: 659, type: 'triangle' as OscillatorType },
    };
  }

  // 정시 정각 (매 시 00분, 0~1분) – 차임
  if (m === 0 && h >= 9 && h <= 18) {
    return {
      emoji: '🔔',
      message: `${h}시 정각!`,
      sub: '땡~ 시간은 금이에요 ⏰',
      sound: { freq: 440, type: 'sine' as OscillatorType },
    };
  }

  return null;
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
};

const formatDate = (date: Date) => {
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
};

const TimeGreeting: React.FC<TimeGreetingProps> = ({ name, avatarUrl, attendanceAction }) => {
  const { user } = useAuth();
  const [greeting, setGreeting] = useState(getGreetingData());
  const [now, setNow] = useState(new Date());
  const [myStatus, setMyStatus] = useState<WorkStatus>('available');
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [secretEvent, setSecretEvent] = useState<SecretEvent | null>(null);
  const [showSecretBanner, setShowSecretBanner] = useState(false);
  const secretSoundPlayed = useRef<string | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch custom secret events from DB
  const { data: customSecretEvents } = useQuery({
    queryKey: ['secret-events-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('secret_events')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  // Fetch today's event schedules from the notice table.
  const { data: todayEvents } = useQuery({
    queryKey: ['today-upcoming-events'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('announcements')
        .select('id, title, meeting_date, meeting_location, event_end_date, content, author_name')
        .eq('announcement_type', 'event')
        .or(`meeting_date.eq.${today},and(meeting_date.lte.${today},event_end_date.gte.${today})`)
        .order('meeting_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  const { data: todayReservations } = useQuery({
    queryKey: ['today-meeting-reservation-reminders', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabaseAny
        .from('meeting_reservations')
        .select('id, title, audience_type, employee_meeting_type, client_meeting_type, meeting_date, start_time, location, client_name, created_by, participant_ids, status')
        .eq('meeting_date', today)
        .in('status', ['scheduled', 'confirmed'])
        .order('start_time', { ascending: true });
      if (error) {
        if (isMissingMeetingReservationsTableError(error)) return [];
        throw error;
      }
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  // Filter upcoming schedules within 30 minutes. All-day events remain visible.
  const upcomingEvents = useMemo(() => {
    const nowDate = new Date();
    const currentMinute = nowDate.getHours() * 60 + nowDate.getMinutes();

    const eventItems = (todayEvents || []).map((ev) => ({
      id: ev.id,
      title: ev.title,
      eventType: 'event' as const,
      meeting_date: ev.meeting_date,
      meeting_time: null,
      meeting_location: ev.meeting_location,
      content: ev.content,
      author_name: ev.author_name,
      minutesLeft: null,
      isAllDay: true,
    }));

    const reservationItems = (todayReservations || [])
      .map((reservation: any) => {
        const [h, min] = String(reservation.start_time || '').split(':').map(Number);
        if (isNaN(h) || isNaN(min)) return null;
        const eventMin = h * 60 + min;
        const diff = eventMin - currentMinute;
        if (diff <= 0 || diff > 30) return null;
        return {
          id: reservation.id,
          title: reservation.title,
          eventType: reservation.audience_type === 'employee' ? 'conference' as const : 'meeting' as const,
          meeting_date: reservation.meeting_date,
          meeting_time: reservation.start_time,
          meeting_location: reservation.location || reservation.client_name,
          content: reservation.client_name || '',
          author_name: reservation.audience_type === 'employee' ? '직원 미팅' : '클라이언트 미팅',
          minutesLeft: diff,
          isAllDay: false,
        };
      })
      .filter(Boolean);

    return [...reservationItems, ...eventItems]
      .slice(0, 3) as Array<{
        id: string; title: string; eventType: 'meeting' | 'conference' | 'event';
        meeting_date: string | null; meeting_time: string | null;
        meeting_location: string | null; content: string;
        author_name: string; minutesLeft: number | null; isAllDay: boolean;
      }>;
  }, [todayEvents, todayReservations, now]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
      setGreeting(getGreetingData());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 🎯 시크릿 이벤트 감지 (하드코딩 + DB 커스텀)
  useEffect(() => {
    // 1. 하드코딩된 이벤트 확인
    let event = getSecretEvent(name);

    // 2. DB 커스텀 이벤트 확인 (하드코딩이 없을 때)
    if (!event && customSecretEvents && customSecretEvents.length > 0) {
      const n = new Date();
      const h = n.getHours();
      const m = n.getMinutes();
      const day = n.getDay();
      const date = n.getDate();
      const month = n.getMonth() + 1;

      for (const ce of customSecretEvents) {
        let match = true;
        if (ce.trigger_hour != null && ce.trigger_hour !== h) match = false;
        if (ce.trigger_minute != null && ce.trigger_minute !== m) match = false;
        if (ce.trigger_day_of_week != null && ce.trigger_day_of_week !== day) match = false;
        if (ce.trigger_date != null && ce.trigger_date !== date) match = false;
        if (ce.trigger_month != null && ce.trigger_month !== month) match = false;
        if (match) {
          event = {
            emoji: ce.emoji,
            message: ce.message,
            sub: (ce.sub_message || '').replace('{name}', name),
            particles: ce.particles || undefined,
            sound: ce.sound_enabled ? { freq: ce.sound_freq || 440, type: 'triangle' as OscillatorType } : undefined,
          };
          break;
        }
      }
    }

    const eventKey = event ? event.message : null;

    if (event && eventKey !== secretSoundPlayed.current) {
      setSecretEvent(event);
      setShowSecretBanner(true);
      secretSoundPlayed.current = eventKey;

      const timer = setTimeout(() => setShowSecretBanner(false), 10000);
      return () => clearTimeout(timer);
    } else if (!event) {
      setSecretEvent(null);
      setShowSecretBanner(false);
    }
  }, [now, name, customSecretEvents]);

  // Sync with presence channel
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('employee-status', {
      config: { private: true, presence: { key: user.id } },
    });
    presenceChannelRef.current = channel;

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
      presenceChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const updateMyStatus = useCallback(async (newStatus: WorkStatus) => {
    setMyStatus(newStatus);
    setStatusPopoverOpen(false);

    await presenceChannelRef.current?.track({ status: newStatus, online_at: new Date().toISOString() });
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
  const workProgressRounded = Math.round(workProgress);
  const isWorkHalfMilestone = workProgress >= 50;
  const isWorkComplete = workProgress >= 100;
  const flowNotice = (() => {
    if (currentMin >= 11 * 60 + 30 && currentMin < 13 * 60 + 30) {
      return { icon: <Utensils className="h-3.5 w-3.5" />, text: '점심 리듬으로 전환할 시간입니다.' };
    }
    if (currentMin >= 17 * 60 + 30 && currentMin < 19 * 60) {
      return { icon: <Clock className="h-3.5 w-3.5" />, text: '마감 전 확인할 업무를 정리하세요.' };
    }
    if (currentMin >= 19 * 60 && currentMin < 23 * 60 + 30) {
      return { icon: <Moon className="h-3.5 w-3.5" />, text: '오늘의 업무 기록을 마무리해 주세요.' };
    }
    return null;
  })();

  useEffect(() => {
    if (!isWorkComplete) return;
    triggerDailyHamzzi('work-complete', 'work_complete', {
      message: '오늘 근무 흐름이 완료됐습니다.',
      description: '퇴근 전 마지막 확인만 남았습니다.',
      durationMs: 3400,
    });
  }, [isWorkComplete]);

  return (
    <div className="dashboard-greeting-card relative overflow-hidden rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-none animate-fade-in sm:p-5">
      {flowNotice && (
        <div className="dashboard-flow-ribbon mb-3 flex w-fit items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm">
          {flowNotice.icon}
          <span>{flowNotice.text}</span>
        </div>
      )}
      {/* 🎯 시크릿 이벤트 배너 */}
      {showSecretBanner && secretEvent && (
        <>
          {/* 배너 */}
          <div
            className="dashboard-secret-ribbon relative mb-3 cursor-pointer rounded-lg border border-border bg-muted/30 p-3"
            onClick={() => setShowSecretBanner(false)}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-lg">
                {secretEvent.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{secretEvent.message}</p>
                <p className="truncate text-xs text-muted-foreground">{secretEvent.sub}</p>
              </div>
              <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </div>
        </>
      )}
      {/* Mobile: stacked layout, Desktop: side-by-side */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
              <PopoverTrigger asChild>
                <Avatar className="h-14 w-14 shrink-0 cursor-pointer rounded-lg border border-border bg-muted shadow-none transition-transform hover:scale-[1.02] sm:h-20 sm:w-20">
                  <AvatarImage src={avatarUrl || undefined} alt={name} className="object-cover" />
                  <AvatarFallback className="bg-muted text-foreground text-lg font-semibold sm:text-xl">
                    {name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </PopoverTrigger>
              <PopoverContent className="w-44 rounded-lg border-border p-1.5" side="bottom" align="start">
                <p className="text-[10px] font-medium text-muted-foreground px-2 py-1">내 상태 변경</p>
                {(Object.entries(STATUS_CONFIG) as [WorkStatus, typeof STATUS_CONFIG[WorkStatus]][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => updateMyStatus(key)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                      myStatus === key ? 'bg-accent font-medium' : 'hover:bg-muted'
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${cfg.dotColor}`} />
                    <span>{cfg.label}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-full ${statusCfg.dotColor} border-2 border-background`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground transition-colors duration-1000 sm:h-9 sm:w-9">
                {greeting.icon}
              </div>
              <p className="text-base font-semibold leading-tight text-foreground sm:text-lg">
                {name} 님, {greeting.message}
              </p>
            </div>
            {greeting.sub && (
              <p className="ml-10 text-xs text-muted-foreground sm:ml-11 sm:text-sm">{greeting.sub}</p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold tabular-nums text-foreground transition-colors duration-1000 sm:text-xl">
            {formatTime(now)}
          </p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            {formatDate(now)}
          </p>
          {attendanceAction && (
            <div className="mt-3 flex justify-end">
              {attendanceAction}
            </div>
          )}
        </div>
      </div>

      {/* Work Progress Bar */}
      <div className="mt-4 border-t border-border/50 pt-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">오늘의 근무 진행률</span>
          </div>
          <span className="text-xs font-semibold text-foreground tabular-nums">{workProgressRounded}%</span>
        </div>

        {/* Progress track */}
        <div className="dashboard-progress-track relative h-2 overflow-hidden rounded-full bg-muted">
          {/* Filled portion */}
          <div
            className={cn(
              'dashboard-progress-fill absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out',
              isWorkHalfMilestone && 'dashboard-progress-fill--milestone',
              isWorkComplete && 'dashboard-progress-fill--complete',
            )}
            style={{
              width: `${workProgress}%`,
            }}
          />
          {isWorkComplete && <span className="dashboard-progress-ripple" aria-hidden="true" />}
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
            경과 <span className="font-semibold text-foreground">{elapsedHours}시간 {elapsedMins}분</span>
          </span>
          <span className="text-[11px] text-muted-foreground">
            남은 시간 <span className="font-semibold text-foreground">{remainingHours}시간 {remainingMins}분</span>
          </span>
        </div>
      </div>

      {/* Upcoming event reminders - separate cards */}
      {upcomingEvents.length > 0 && (
        <div className={`mt-3 grid gap-2.5 ${upcomingEvents.length === 1 ? 'grid-cols-1' : upcomingEvents.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
          {upcomingEvents.map((ev) => {
            const typeConfig = {
              conference: { label: '회의', badgeBg: 'bg-muted text-foreground', cardBorder: 'border-border', cardBg: 'bg-card', icon: <Users className="h-3.5 w-3.5" /> },
              meeting: { label: '미팅', badgeBg: 'bg-muted text-foreground', cardBorder: 'border-border', cardBg: 'bg-card', icon: <Coffee className="h-3.5 w-3.5" /> },
              event: { label: '이벤트', badgeBg: 'bg-muted text-foreground', cardBorder: 'border-border', cardBg: 'bg-card', icon: <Calendar className="h-3.5 w-3.5" /> },
            }[ev.eventType] || { label: '일정', badgeBg: 'bg-muted text-muted-foreground', cardBorder: 'border-border', cardBg: 'bg-card', icon: <Calendar className="h-3.5 w-3.5" /> };

            const formattedDate = ev.meeting_date
              ? new Date(ev.meeting_date + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' })
              : null;

            return (
              <div key={ev.id} className={`rounded-lg border ${typeConfig.cardBorder} ${typeConfig.cardBg} p-3 space-y-1.5`}>
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
                      <MapPin className="h-3 w-3 shrink-0" />
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
