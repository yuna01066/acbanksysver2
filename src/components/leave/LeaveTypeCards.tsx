import React, { useState, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, CalendarDays, Heart, Baby, Gem, Sparkles, AlertTriangle, Sun, Mail, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { calculateBusinessDays } from '@/hooks/useLeaveRequests';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isWeekend, isWithinInterval, isBefore, isAfter } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { LeavePolicy } from '@/hooks/useLeavePolicy';

export interface LeaveTypeConfig {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  isHalf?: boolean;
  isPaid?: boolean;
}

export const EXTENDED_LEAVE_TYPES: LeaveTypeConfig[] = [
  { key: 'annual', label: '연차', description: '1일', icon: CalendarDays, isPaid: true },
  { key: 'family_care', label: '가족돌봄', description: '신청 시 1일 부여', icon: Heart },
  { key: 'infertility', label: '난임 치료', description: '매년 6일 부여', icon: Baby },
  { key: 'marriage_self', label: '결혼 - 본인', description: '신청 시 2일 부여', icon: Gem },
  { key: 'marriage_child', label: '결혼 - 자녀', description: '신청 시 1일 부여', icon: Gem },
  { key: 'refresh', label: '리프레시', description: '3년 근속 시 30일 부여', icon: Sparkles },
  { key: 'emergency', label: '비상', description: '신청 시 1일 부여', icon: AlertTriangle },
  { key: 'summer', label: '여름(바캉스)', description: '매년 3일 부여', icon: Sun },
  { key: 'condolence_close', label: '조의 - 부모/배우자/자녀', description: '신청 시 5일 부여', icon: Mail },
  { key: 'condolence_extended', label: '조의 - 조부모/형제/자매', description: '신청 시 3일 부여', icon: Mail },
  { key: 'half_am', label: '오전 반차', description: '0.5일', icon: CalendarDays, isHalf: true, isPaid: true },
  { key: 'half_pm', label: '오후 반차', description: '0.5일', icon: CalendarDays, isHalf: true, isPaid: true },
  { key: 'sick', label: '병가', description: '신청 시 부여', icon: AlertTriangle },
  { key: 'unpaid', label: '무급휴가', description: '신청 시 부여', icon: CalendarDays },
];

interface LeaveTypeCardsProps {
  onSubmit: (params: {
    leave_type: string;
    start_date: string;
    end_date: string;
    days: number;
    reason?: string;
  }) => Promise<boolean | undefined>;
  remainingDays: number;
  leavePolicy: LeavePolicy;
  canRequest: (requestDays: number, remainingDays: number) => boolean;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const LeaveTypeCards: React.FC<LeaveTypeCardsProps> = ({ onSubmit, remainingDays, leavePolicy, canRequest }) => {
  const [selectedType, setSelectedType] = useState<LeaveTypeConfig | null>(null);
  const [step, setStep] = useState<'calendar' | 'reason'>('calendar');
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const isHalf = selectedType?.isHalf || false;

  const calculatedDays = useMemo(() => {
    if (!rangeStart) return 0;
    if (isHalf) return 0.5;
    if (!rangeEnd) return 0;
    return calculateBusinessDays(
      format(rangeStart, 'yyyy-MM-dd'),
      format(rangeEnd, 'yyyy-MM-dd')
    );
  }, [rangeStart, rangeEnd, isHalf]);

  const exceedsBalance = calculatedDays > remainingDays;
  const isBlocked = exceedsBalance && !leavePolicy.allow_advance_use;

  const handleDayClick = useCallback((day: Date) => {
    if (isHalf) {
      setRangeStart(day);
      setRangeEnd(day);
      return;
    }
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(day);
      setRangeEnd(null);
    } else {
      if (isBefore(day, rangeStart)) {
        setRangeEnd(rangeStart);
        setRangeStart(day);
      } else {
        setRangeEnd(day);
      }
    }
  }, [rangeStart, rangeEnd, isHalf]);

  const handleSubmit = async () => {
    if (!selectedType || !rangeStart) return;
    const finalEnd = isHalf ? rangeStart : rangeEnd;
    if (!finalEnd) return;

    setSubmitting(true);
    const success = await onSubmit({
      leave_type: selectedType.key,
      start_date: format(rangeStart, 'yyyy-MM-dd'),
      end_date: format(finalEnd, 'yyyy-MM-dd'),
      days: calculatedDays,
      reason: reason || undefined,
    });
    setSubmitting(false);
    if (success) {
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedType(null);
    setStep('calendar');
    setRangeStart(null);
    setRangeEnd(null);
    setReason('');
    setCalendarMonth(new Date());
  };

  const handleNext = () => {
    if (step === 'calendar') {
      setStep('reason');
    }
  };

  // Generate calendar grid for two months
  const renderMonth = (monthDate: Date) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: calStart, end: calEnd });

    return (
      <div className="flex-1">
        <h3 className="text-center font-semibold text-sm mb-3">
          {format(monthDate, 'yyyy년 M월')}
        </h3>
        <div className="grid grid-cols-7 gap-0">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-xs text-muted-foreground py-1">{d}</div>
          ))}
          {days.map((day, i) => {
            const inMonth = isSameMonth(day, monthDate);
            const isSelected = rangeStart && isSameDay(day, rangeStart);
            const isEnd = rangeEnd && isSameDay(day, rangeEnd);
            const inRange = rangeStart && rangeEnd && isWithinInterval(day, { start: rangeStart, end: rangeEnd }) && !isSelected && !isEnd;
            const weekend = isWeekend(day);

            return (
              <button
                key={i}
                type="button"
                onClick={() => inMonth && handleDayClick(day)}
                disabled={!inMonth}
                className={`
                  h-9 w-full text-sm relative flex items-center justify-center transition-colors
                  ${!inMonth ? 'text-muted-foreground/30' : weekend ? 'text-muted-foreground' : 'text-foreground'}
                  ${isSelected || isEnd ? 'bg-emerald-500 text-white rounded-full font-semibold z-10' : ''}
                  ${inRange ? 'bg-emerald-100 dark:bg-emerald-900/30' : ''}
                  ${inMonth && !isSelected && !isEnd && !inRange ? 'hover:bg-muted rounded-full' : ''}
                `}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const nextMonth = addMonths(calendarMonth, 1);

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold mb-4">휴가 등록</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {EXTENDED_LEAVE_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <Card
                key={type.key}
                className="p-4 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group relative"
                onClick={() => {
                  setSelectedType(type);
                  setStep('calendar');
                  setCalendarMonth(new Date());
                }}
              >
                <div className="flex flex-col gap-3">
                  <Icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  <div>
                    <p className="text-sm font-medium">{type.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={!!selectedType} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden [&>button]:hidden">
          {step === 'calendar' ? (
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {selectedType && (
                    <>
                      <selectedType.icon className="h-4 w-4" />
                      <span>{selectedType.label}</span>
                      {selectedType.isPaid !== false && <span>· 유급</span>}
                    </>
                  )}
                </div>
                <button onClick={handleClose} className="rounded-full p-1 hover:bg-muted">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              {/* Selected range display */}
              <div className="mb-4">
                {rangeStart ? (
                  <>
                    <h2 className="text-xl font-bold">
                      {format(rangeStart, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                      {rangeEnd && !isSameDay(rangeStart, rangeEnd) && (
                        <> – {format(rangeEnd, 'M월 d일 (EEE)', { locale: ko })}</>
                      )}
                    </h2>
                    {calculatedDays > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        총 {calculatedDays}일
                        {exceedsBalance && leavePolicy.allow_advance_use && '을 당겨서 사용해요.'}
                        {exceedsBalance && !leavePolicy.allow_advance_use && ' (잔여 연차 초과)'}
                        {!exceedsBalance && calculatedDays > 0 && '을 사용해요.'}
                      </p>
                    )}
                  </>
                ) : (
                  <h2 className="text-xl font-bold text-muted-foreground">날짜를 선택하세요</h2>
                )}
              </div>

              {/* Two-month calendar */}
              <div className="flex items-center gap-2 mb-2">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCalendarMonth(m => subMonths(m, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCalendarMonth(m => addMonths(m, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex gap-6">
                {renderMonth(calendarMonth)}
                {!isHalf && renderMonth(nextMonth)}
              </div>

              {/* Next button */}
              <Button
                onClick={handleNext}
                disabled={!rangeStart || (!isHalf && !rangeEnd) || isBlocked}
                className="w-full mt-6 h-12 text-base bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                다음
              </Button>

              {isBlocked && (
                <p className="text-destructive text-xs text-center mt-2">⚠️ 잔여 연차를 초과합니다.</p>
              )}
            </div>
          ) : (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{selectedType?.label} 신청</h2>
                <button onClick={handleClose} className="rounded-full p-1 hover:bg-muted">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              <div className="rounded-lg bg-muted/50 p-3 text-sm mb-4">
                <p className="font-medium">
                  {rangeStart && format(rangeStart, 'yyyy.MM.dd (EEE)', { locale: ko })}
                  {rangeEnd && rangeStart && !isSameDay(rangeStart, rangeEnd) && (
                    <> ~ {format(rangeEnd, 'yyyy.MM.dd (EEE)', { locale: ko })}</>
                  )}
                </p>
                <p className="text-muted-foreground mt-1">사용 일수: {calculatedDays}일 (잔여: {remainingDays}일)</p>
              </div>

              <div className="mb-4">
                <Label className="text-sm">사유 (선택)</Label>
                <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="mt-1 resize-none" placeholder="사유를 입력하세요..." />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('calendar')} className="flex-1">
                  이전
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  신청하기
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LeaveTypeCards;
