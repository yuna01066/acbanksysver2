import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, CalendarCheck, CalendarClock, CalendarX } from 'lucide-react';

interface LeaveSummaryCardsProps {
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
}

const LeaveSummaryCards: React.FC<LeaveSummaryCardsProps> = ({
  totalDays, usedDays, pendingDays, remainingDays,
}) => {
  const cards = [
    { icon: Calendar, label: '총 연차', value: totalDays, suffix: '일', color: 'text-primary' },
    { icon: CalendarCheck, label: '사용', value: usedDays, suffix: '일', color: 'text-green-600 dark:text-green-400' },
    { icon: CalendarClock, label: '승인 대기', value: pendingDays, suffix: '일', color: 'text-yellow-600 dark:text-yellow-400' },
    { icon: CalendarX, label: '잔여', value: remainingDays, suffix: '일', color: 'text-blue-600 dark:text-blue-400' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c, i) => (
        <Card key={i} className="border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <c.icon className={`h-4 w-4 ${c.color}`} />
              <span className="text-xs text-muted-foreground">{c.label}</span>
            </div>
            <div className={`text-2xl font-bold ${c.color}`}>
              {c.value}<span className="text-sm font-normal ml-1">{c.suffix}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default LeaveSummaryCards;
