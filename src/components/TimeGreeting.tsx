import React, { useState, useEffect } from 'react';
import { Sun, Moon, Coffee, Utensils, Clock, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
  const [greeting, setGreeting] = useState(getGreetingData());
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
      setGreeting(getGreetingData());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`animate-fade-in rounded-xl border p-5 shadow-sm bg-gradient-to-r ${greeting.gradient} transition-colors duration-1000`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14 shrink-0 border-2 border-background shadow-sm">
            <AvatarImage src={avatarUrl || undefined} alt={name} className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
              {name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className={`animate-scale-in flex h-10 w-10 items-center justify-center rounded-full ${greeting.iconBg} transition-colors duration-1000`}>
            {greeting.icon}
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">
              {name} 님, {greeting.message}
            </p>
            {greeting.sub && (
              <p className="text-sm text-muted-foreground">{greeting.sub}</p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-2xl font-bold tabular-nums tracking-tight ${greeting.timeColor} transition-colors duration-1000`}>
            {formatTime(now)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDate(now)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TimeGreeting;
