import React, { useState, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, CalendarDays, Heart, Baby, Gem, Sparkles, AlertTriangle, Sun, Mail, ChevronLeft, ChevronRight, ChevronDown, X } from 'lucide-react';
import { calculateBusinessDays } from '@/hooks/useLeaveRequests';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isWeekend, isWithinInterval, isBefore, isAfter } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { LeavePolicy } from '@/hooks/useLeavePolicy';
import { cn } from '@/lib/utils';

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
  { key: 'half_am', label: '오전 반차', description: '0.5일', icon: CalendarDays, isHalf: true, isPaid: true },
  { key: 'half_pm', label: '오후 반차', description: '0.5일', icon: CalendarDays, isHalf: true, isPaid: true },
  { key: 'other', label: '기타', description: '직접 사유 입력', icon: CalendarDays },
  { key: 'family_care', label: '가족돌봄', description: '신청 시 1일 부여', icon: Heart },
  { key: 'infertility', label: '난임 치료', description: '매년 6일 부여', icon: Baby },
  { key: 'marriage_self', label: '결혼 - 본인', description: '신청 시 2일 부여', icon: Gem },
  { key: 'marriage_child', label: '결혼 - 자녀', description: '신청 시 1일 부여', icon: Gem },
  { key: 'refresh', label: '리프레시', description: '3년 근속 시 30일 부여', icon: Sparkles },
  { key: 'emergency', label: '비상', description: '신청 시 1일 부여', icon: AlertTriangle },
  { key: 'summer', label: '여름(바캉스)', description: '매년 3일 부여', icon: Sun },
  { key: 'condolence_close', label: '조의 - 부모/배우자/자녀', description: '신청 시 5일 부여', icon: Mail },
  { key: 'condolence_extended', label: '조의 - 조부모/형제/자매', description: '신청 시 3일 부여', icon: Mail },
  { key: 'sick', label: '병가', description: '신청 시 부여', icon: AlertTriangle },
  { key: 'unpaid', label: '무급휴가', description: '신청 시 부여', icon: CalendarDays },
];

const QUICK_LEAVE_KEYS = new Set(['annual', 'half_am', 'half_pm', 'other']);

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
  const [detailOpen, setDetailOpen] = useState(false);
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
  const quickTypes = EXTENDED_LEAVE_TYPES.filter(type => QUICK_LEAVE_KEYS.has(type.key));
  const detailTypes = EXTENDED_LEAVE_TYPES.filter(type => !QUICK_LEAVE_KEYS.has(type.key));
  const renderLeaveTypeCard = (type: LeaveTypeConfig, compact = false) => {
    const Icon = type.icon;
    return (
      <Card
        key={type.key}
        className={cn(
          'cursor-pointer border bg-background/80 transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm',
          compact ? 'p-3' : 'p-4'
        )}
        onClick={() => {
          setSelectedType(type);
          setStep('calendar');
          setCalendarMonth(new Date());
        }}
      >
        <div className={cn('flex gap-3', compact ? 'items-center' : 'flex-col')}>
          <div className={cn(
            'flex shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-primary/5 text-primary',
            compact ? 'h-8 w-8' : 'h-10 w-10'
          )}>
            <Icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{type.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{type.description}</p>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <>
      <div>
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">빠른 휴가 신청</h2>
            <p className="text-sm text-muted-foreground">자주 쓰는 유형만 먼저 고르고, 상세 유형은 필요할 때 펼칩니다.</p>
          </div>
          <div className="text-xs text-muted-foreground">잔여 {remainingDays.toFixed(1)}일</div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {quickTypes.map(type => renderLeaveTypeCard(type))}
        </div>

        <Collapsible open={detailOpen} onOpenChange={setDetailOpen} className="mt-4">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 px-0 text-muted-foreground">
              상세 휴가 유형
              <ChevronDown className={cn('h-4 w-4 transition-transform', detailOpen && 'rotate-180')} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {detailTypes.map(type => renderLeaveTypeCard(type, true))}
            </div>
          </CollapsibleContent>
        </Collapsible>
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
