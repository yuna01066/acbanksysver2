import React, { useState, useEffect } from 'react';
import { Sun, Moon, Coffee, Utensils, Clock } from 'lucide-react';

interface TimeGreetingProps {
  name: string;
}

const getGreeting = (): { message: string; icon: React.ReactNode; sub?: string } => {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const time = h * 60 + m; // minutes since midnight

  // Special time-based messages
  if (h === 11 && m >= 30) {
    return { message: '점심시간이 얼마 남지 않았어요!', icon: <Utensils className="h-5 w-5 text-orange-500" />, sub: '맛있는 점심 기대하세요 🍽️' };
  }
  if (h === 12) {
    return { message: '점심시간입니다!', icon: <Utensils className="h-5 w-5 text-orange-500" />, sub: '맛있는 식사 하세요 🍚' };
  }
  if (h === 17 && m >= 30) {
    return { message: '퇴근시간이 얼마 남지 않았어요!', icon: <Clock className="h-5 w-5 text-green-500" />, sub: '오늘도 수고하셨습니다 🎉' };
  }

  // General time-based greetings
  if (h >= 5 && h < 12) {
    return { message: '좋은 아침입니다.', icon: <Sun className="h-5 w-5 text-amber-500" />, sub: '오늘도 화이팅! ☀️' };
  }
  if (h >= 12 && h < 18) {
    return { message: '좋은 오후입니다.', icon: <Coffee className="h-5 w-5 text-primary" />, sub: '남은 오후도 힘내세요 💪' };
  }
  return { message: '좋은 저녁입니다.', icon: <Moon className="h-5 w-5 text-indigo-400" />, sub: '오늘 하루도 수고하셨어요 🌙' };
};

const TimeGreeting: React.FC<TimeGreetingProps> = ({ name }) => {
  const [greeting, setGreeting] = useState(getGreeting());

  useEffect(() => {
    const interval = setInterval(() => {
      setGreeting(getGreeting());
    }, 60000); // update every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-3 px-1 py-2">
      {greeting.icon}
      <div>
        <p className="text-lg font-semibold text-foreground">
          {name} 님, {greeting.message}
        </p>
        {greeting.sub && (
          <p className="text-sm text-muted-foreground">{greeting.sub}</p>
        )}
      </div>
    </div>
  );
};

export default TimeGreeting;
