import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, CalendarCheck, CalendarClock, CalendarX, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface LeaveSummaryCardsProps {
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  unitLabel?: string;
  allowAdvanceUse?: boolean;
  expiredDays?: number;
  expiringSoonDays?: number;
  expirationDate?: Date | null;
}

const LeaveSummaryCards: React.FC<LeaveSummaryCardsProps> = ({
  totalDays, usedDays, pendingDays, remainingDays, unitLabel = '일', allowAdvanceUse = false,
  expiredDays = 0, expiringSoonDays = 0, expirationDate = null,
}) => {
  const cards = [
    { icon: Calendar, label: '총 연차', value: totalDays, color: 'text-primary' },
    { icon: CalendarCheck, label: '사용', value: usedDays, color: 'text-green-600 dark:text-green-400' },
    { icon: CalendarClock, label: '승인 대기', value: pendingDays, color: 'text-yellow-600 dark:text-yellow-400' },
    { icon: CalendarX, label: allowAdvanceUse ? '잔여 (당겨쓰기 가능)' : '잔여', value: remainingDays, color: remainingDays < 0 ? 'text-destructive' : 'text-blue-600 dark:text-blue-400' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <Card key={i} className="border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <c.icon className={`h-4 w-4 ${c.color}`} />
                <span className="text-xs text-muted-foreground">{c.label}</span>
              </div>
              <div className={`text-2xl font-bold ${c.color}`}>
                {c.value}<span className="text-sm font-normal ml-1">{unitLabel}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 소멸 정보 배너 */}
      {(expiredDays > 0 || expiringSoonDays > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {expiredDays > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-300">소멸된 연차</p>
                <p className="text-xs text-red-600 dark:text-red-400">
                  과거 기간 미사용 연차 <strong>{expiredDays}{unitLabel}</strong>이 자동 소멸되었습니다.
                </p>
              </div>
            </div>
          )}
          {expiringSoonDays > 0 && expirationDate && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 p-3 flex items-start gap-2">
              <CalendarClock className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-orange-800 dark:text-orange-300">소멸 예정</p>
                <p className="text-xs text-orange-600 dark:text-orange-400">
                  <strong>{expiringSoonDays}{unitLabel}</strong>이 {format(expirationDate, 'yyyy.MM.dd')}까지 미사용 시 소멸됩니다.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LeaveSummaryCards;
