import React, { useState, useEffect } from 'react';
import { Sun, Moon, Coffee, Utensils, Clock } from 'lucide-react';

interface TimeGreetingProps {
  name: string;
}

const getGreeting = (): { message: string; icon: React.ReactNode; sub?: string } => {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  if (h === 11 && m >= 30) {
    return { message: '점심시간이 얼마 남지 않았어요!', icon: <Utensils className="h-5 w-5 text-orange-500" />, sub: '맛있는 점심 기대하세요 🍽️' };
  }
  if (h === 12) {
    return { message: '점심시간입니다!', icon: <Utensils className="h-5 w-5 text-orange-500" />, sub: '맛있는 식사 하세요 🍚' };
  }
  if (h === 17 && m >= 30) {
    return { message: '퇴근시간이 얼마 남지 않았어요!', icon: <Clock className="h-5 w-5 text-green-500" />, sub: '오늘도 수고하셨습니다 🎉' };
  }
  if (h >= 5 && h < 12) {
    return { message: '좋은 아침입니다.', icon: <Sun className="h-5 w-5 text-amber-500" />, sub: '오늘도 화이팅! ☀️' };
  }
  if (h >= 12 && h < 18) {
    return { message: '좋은 오후입니다.', icon: <Coffee className="h-5 w-5 text-primary" />, sub: '남은 오후도 힘내세요 💪' };
  }
  return { message: '좋은 저녁입니다.', icon: <Moon className="h-5 w-5 text-indigo-400" />, sub: '오늘 하루도 수고하셨어요 🌙' };
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
};

const formatDate = (date: Date) => {
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
};

const TimeGreeting: React.FC<TimeGreetingProps> = ({ name }) => {
  const [greeting, setGreeting] = useState(getGreeting());
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
      setGreeting(getGreeting());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="animate-fade-in flex items-center justify-between gap-4 px-2 py-3">
      <div className="flex items-center gap-3">
        <div className="animate-scale-in">
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
        <p className="text-2xl font-bold tabular-nums text-foreground tracking-tight">
          {formatTime(now)}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDate(now)}
        </p>
      </div>
    </div>
  );
};

export default TimeGreeting;
