import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Sun, Moon, Coffee, Utensils, Clock, Calendar, MapPin, Users, Sparkles } from 'lucide-react';
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

// 🎯 시크릿 이벤트 시스템
type SecretEvent = {
  emoji: string;
  message: string;
  sub: string;
  gradient: string;
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
      gradient: 'from-indigo-500/20 via-purple-500/15 to-pink-500/10 dark:from-indigo-800/40 dark:via-purple-800/30 dark:to-pink-800/20',
      particles: ['⭐', '✨', '🌟', '💫', '🌙'],
    };
  }

  // 새벽 2~4시 – 밤올빼미
  if (h >= 2 && h < 4) {
    return {
      emoji: '🦉',
      message: '밤올빼미 모드 활성화!',
      sub: `이 시간에 일하는 ${name}님은 진정한 야행성... 건강 조심하세요 🌙`,
      gradient: 'from-slate-700/20 via-indigo-800/15 to-violet-900/10 dark:from-slate-900/50 dark:via-indigo-950/40 dark:to-violet-950/30',
      particles: ['🦉', '🌙', '⭐', '🌟'],
    };
  }

  // 금요일 17:30 이후 – 불금
  if (day === 5 && (h > 17 || (h === 17 && m >= 30))) {
    return {
      emoji: '🎉',
      message: '불금이다! 🔥',
      sub: `${name}님, 한 주 고생하셨습니다! 즐거운 주말 보내세요 🥳`,
      gradient: 'from-orange-500/20 via-red-500/15 to-pink-500/10 dark:from-orange-800/40 dark:via-red-800/30 dark:to-pink-800/20',
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
      gradient: 'from-blue-500/15 via-cyan-500/10 to-teal-500/10 dark:from-blue-800/30 dark:via-cyan-800/20 dark:to-teal-800/15',
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
      gradient: 'from-emerald-500/15 via-green-500/10 to-lime-500/10 dark:from-emerald-800/30 dark:via-green-800/20 dark:to-lime-800/15',
      particles: ['🎯', '📅', '🌱', '✨'],
    };
  }

  // 크리스마스 (12/25)
  if (month === 12 && date === 25) {
    return {
      emoji: '🎄',
      message: '메리 크리스마스! 🎅',
      sub: `${name}님, 행복한 크리스마스 보내세요!`,
      gradient: 'from-red-500/20 via-green-500/15 to-red-500/10 dark:from-red-800/40 dark:via-green-800/30 dark:to-red-800/20',
      particles: ['🎄', '🎅', '🎁', '⛄', '❄️', '🌟'],
    };
  }

  // 새해 (1/1)
  if (month === 1 && date === 1) {
    return {
      emoji: '🎆',
      message: '새해 복 많이 받으세요!',
      sub: `${name}님, ${now.getFullYear()}년도 좋은 일만 가득하길! 🎊`,
      gradient: 'from-yellow-500/20 via-amber-500/15 to-orange-500/10 dark:from-yellow-800/40 dark:via-amber-800/30 dark:to-orange-800/20',
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
      gradient: 'from-amber-400/15 via-yellow-400/10 to-orange-400/10 dark:from-amber-800/25 dark:via-yellow-800/15 dark:to-orange-800/10',
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

const TimeGreeting: React.FC<TimeGreetingProps> = ({ name, avatarUrl }) => {
  const { user } = useAuth();
  const [greeting, setGreeting] = useState(getGreetingData());
  const [now, setNow] = useState(new Date());
  const [myStatus, setMyStatus] = useState<WorkStatus>('available');
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [secretEvent, setSecretEvent] = useState<SecretEvent | null>(null);
  const [showSecretBanner, setShowSecretBanner] = useState(false);
  const [secretParticles, setSecretParticles] = useState<{ id: number; emoji: string; x: number; delay: number }[]>([]);
  const secretSoundPlayed = useRef<string | null>(null);

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
            gradient: ce.gradient || 'from-primary/15 via-primary/10 to-accent/10',
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

      if (event.particles) {
        const newParticles = Array.from({ length: 12 }, (_, i) => ({
          id: i,
          emoji: event!.particles![Math.floor(Math.random() * event!.particles!.length)],
          x: Math.random() * 100,
          delay: Math.random() * 2,
        }));
        setSecretParticles(newParticles);
      }

      if (event.sound) {
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.type = event.sound.type;
          osc.frequency.setValueAtTime(event.sound.freq, audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(event.sound.freq * 1.5, audioCtx.currentTime + 0.15);
          osc.frequency.exponentialRampToValueAtTime(event.sound.freq * 0.8, audioCtx.currentTime + 0.3);
          gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
          osc.start(audioCtx.currentTime);
          osc.stop(audioCtx.currentTime + 0.5);
        } catch (e) { /* audio not supported */ }
      }

      const timer = setTimeout(() => setShowSecretBanner(false), 10000);
      return () => clearTimeout(timer);
    } else if (!event) {
      setSecretEvent(null);
      setShowSecretBanner(false);
      setSecretParticles([]);
    }
  }, [now, name, customSecretEvents]);

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
    <div className={`animate-fade-in glass-card p-4 sm:p-5 bg-gradient-to-r ${greeting.gradient} transition-colors duration-1000 relative overflow-hidden`}>
      {/* 🎯 시크릿 이벤트 배너 */}
      {showSecretBanner && secretEvent && (
        <>
          {/* 파티클 애니메이션 */}
          {secretParticles.map((p) => (
            <span
              key={p.id}
              className="absolute text-lg pointer-events-none animate-secret-particle"
              style={{
                left: `${p.x}%`,
                top: '-20px',
                animationDelay: `${p.delay}s`,
              }}
            >
              {p.emoji}
            </span>
          ))}
          {/* 배너 */}
          <div
            className={`mb-3 rounded-xl p-3 bg-gradient-to-r ${secretEvent.gradient} border border-border/30 backdrop-blur-sm animate-secret-banner cursor-pointer relative`}
            onClick={() => setShowSecretBanner(false)}
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl animate-bounce" style={{ animationDuration: '1.5s' }}>{secretEvent.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">{secretEvent.message}</p>
                <p className="text-xs text-muted-foreground">{secretEvent.sub}</p>
              </div>
              <Sparkles className="h-4 w-4 text-primary animate-pulse shrink-0" />
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
