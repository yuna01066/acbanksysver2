import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { LeaveRequest, LEAVE_TYPES } from '@/hooks/useLeaveRequests';
import { cn } from '@/lib/utils';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  isWithinInterval,
  parseISO,
  isSameDay,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface LeaveCalendarViewProps {
  allRequests: LeaveRequest[];
}

const LEAVE_COLORS: Record<string, string> = {
  annual: 'bg-blue-500',
  monthly: 'bg-cyan-500',
  half_am: 'bg-violet-400',
  half_pm: 'bg-violet-400',
  sick: 'bg-red-500',
  special: 'bg-emerald-500',
  unpaid: 'bg-gray-400',
  family_care: 'bg-pink-400',
  infertility: 'bg-rose-400',
  marriage_self: 'bg-amber-500',
  marriage_child: 'bg-amber-400',
  refresh: 'bg-teal-500',
  emergency: 'bg-orange-500',
  summer: 'bg-sky-400',
  condolence_close: 'bg-slate-500',
  condolence_extended: 'bg-slate-400',
};

const LeaveCalendarView: React.FC<LeaveCalendarViewProps> = ({ allRequests }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const approvedRequests = useMemo(
    () => allRequests.filter(r => r.status === 'approved'),
    [allRequests]
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start of month to align with weekday (Sun=0)
  const startPadding = getDay(monthStart);

  const getLeaveForDay = (day: Date) => {
    return approvedRequests.filter(r => {
      const start = parseISO(r.start_date);
      const end = parseISO(r.end_date);
      return isWithinInterval(day, { start, end }) || isSameDay(day, start) || isSameDay(day, end);
    });
  };

  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            휴가 일정 캘린더
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[100px] text-center">
              {format(currentMonth, 'yyyy년 M월', { locale: ko })}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={200}>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {weekDays.map((d, i) => (
              <div key={d} className={cn(
                "text-center text-xs font-medium py-1.5",
                i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"
              )}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {/* Empty cells for padding */}
            {Array.from({ length: startPadding }).map((_, i) => (
              <div key={`pad-${i}`} className="min-h-[80px] border-t border-l first:border-l-0 p-1" />
            ))}

            {daysInMonth.map((day, i) => {
              const dayLeaves = getLeaveForDay(day);
              const dayOfWeek = getDay(day);
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              const today = isToday(day);

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[80px] border-t p-1 relative",
                    isWeekend && "bg-muted/30",
                    today && "bg-primary/5"
                  )}
                >
                  <span className={cn(
                    "text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full",
                    today && "bg-primary text-primary-foreground",
                    !today && dayOfWeek === 0 && "text-red-500",
                    !today && dayOfWeek === 6 && "text-blue-500",
                  )}>
                    {format(day, 'd')}
                  </span>

                  <div className="mt-0.5 space-y-0.5 overflow-hidden">
                    {dayLeaves.slice(0, 3).map((leave) => (
                      <Tooltip key={leave.id}>
                        <TooltipTrigger asChild>
                          <div className={cn(
                            "text-[10px] leading-tight px-1 py-0.5 rounded truncate text-white cursor-default",
                            LEAVE_COLORS[leave.leave_type] || 'bg-primary'
                          )}>
                            {leave.user_name}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <p className="font-semibold">{leave.user_name}</p>
                          <p>{LEAVE_TYPES[leave.leave_type] || leave.leave_type} · {leave.days}일</p>
                          <p className="text-muted-foreground">{leave.start_date} ~ {leave.end_date}</p>
                          {leave.reason && <p className="mt-1 text-muted-foreground">사유: {leave.reason}</p>}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    {dayLeaves.length > 3 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="text-[10px] text-muted-foreground text-center cursor-default">
                            +{dayLeaves.length - 3}명 더
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-[200px]">
                          {dayLeaves.slice(3).map(l => (
                            <p key={l.id}>{l.user_name} - {LEAVE_TYPES[l.leave_type] || l.leave_type}</p>
                          ))}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t">
            {Object.entries(LEAVE_COLORS).slice(0, 8).map(([key, color]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={cn("w-2.5 h-2.5 rounded-sm", color)} />
                <span className="text-[11px] text-muted-foreground">{LEAVE_TYPES[key] || key}</span>
              </div>
            ))}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
};

export default LeaveCalendarView;
