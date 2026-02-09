import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface LeaveEvent {
  id: string;
  user_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  status: string;
  reason: string | null;
}

interface AttendanceSummary {
  date: string;
  total: number;
  checked_in: number;
  checked_out: number;
  absent: number;
}

const leaveTypeLabels: Record<string, string> = {
  annual: '연차',
  half_day: '반차',
  half_day_am: '오전반차',
  half_day_pm: '오후반차',
  sick: '병가',
  personal: '경조사',
  special: '특별휴가',
  unpaid: '무급휴가',
  other: '기타',
};

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300',
  approved: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300',
  rejected: 'bg-destructive/20 text-destructive border-destructive/30',
};

interface AttendanceCalendarViewProps {
  onDateSelect?: (date: string) => void;
  selectedDate?: string;
}

const AttendanceCalendarView: React.FC<AttendanceCalendarViewProps> = ({ onDateSelect, selectedDate: externalSelectedDate }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [leaveEvents, setLeaveEvents] = useState<LeaveEvent[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalSelectedDate, setInternalSelectedDate] = useState<Date | null>(null);

  const selectedDate = externalSelectedDate ? new Date(externalSelectedDate) : internalSelectedDate;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const startStr = format(monthStart, 'yyyy-MM-dd');
      const endStr = format(monthEnd, 'yyyy-MM-dd');

      const [leaveRes, attendanceRes] = await Promise.all([
        supabase
          .from('leave_requests')
          .select('id, user_name, leave_type, start_date, end_date, days, status, reason')
          .or(`start_date.lte.${endStr},end_date.gte.${startStr}`)
          .in('status', ['pending', 'approved'])
          .order('start_date'),
        supabase
          .from('attendance_records')
          .select('date, status')
          .gte('date', startStr)
          .lte('date', endStr),
      ]);

      if (leaveRes.data) setLeaveEvents(leaveRes.data as LeaveEvent[]);

      // Summarize attendance by date
      if (attendanceRes.data) {
        const map = new Map<string, AttendanceSummary>();
        for (const r of attendanceRes.data) {
          if (!map.has(r.date)) {
            map.set(r.date, { date: r.date, total: 0, checked_in: 0, checked_out: 0, absent: 0 });
          }
          const s = map.get(r.date)!;
          s.total++;
          if (r.status === 'checked_in') s.checked_in++;
          else if (r.status === 'checked_out') s.checked_out++;
          else if (r.status === 'absent') s.absent++;
        }
        setAttendanceSummary(Array.from(map.values()));
      }

      setLoading(false);
    };
    fetchData();
  }, [currentMonth]);

  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return leaveEvents.filter(e => e.start_date <= dateStr && e.end_date >= dateStr);
  };

  const getAttendanceForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return attendanceSummary.find(s => s.date === dateStr);
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];
  const selectedAttendance = selectedDate ? getAttendanceForDate(selectedDate) : null;

  return (
    <Card>
      <CardContent className="p-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-base font-semibold">
            {format(currentMonth, 'yyyy년 M월', { locale: ko })}
          </h3>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="flex gap-4">
            {/* Calendar Grid */}
            <div className="flex-1">
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                ))}
              </div>
              {/* Day cells */}
              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                {calendarDays.map(day => {
                  const events = getEventsForDate(day);
                  const att = getAttendanceForDate(day);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const pendingCount = events.filter(e => e.status === 'pending').length;
                  const approvedCount = events.filter(e => e.status === 'approved').length;

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const isSelected = selectedDate && isSameDay(day, selectedDate);
                        if (onDateSelect) {
                          onDateSelect(isSelected ? '' : dateStr);
                        } else {
                          setInternalSelectedDate(isSelected ? null : day);
                        }
                      }}
                      className={cn(
                        'bg-card p-1.5 min-h-[80px] text-left transition-colors hover:bg-accent/50 flex flex-col',
                        !isCurrentMonth && 'opacity-30',
                        isSelected && 'ring-2 ring-primary ring-inset',
                        isToday(day) && 'bg-primary/5'
                      )}
                    >
                      <span className={cn(
                        'text-xs font-medium mb-1',
                        isToday(day) && 'text-primary font-bold',
                        day.getDay() === 0 && 'text-destructive',
                        day.getDay() === 6 && 'text-blue-500'
                      )}>
                        {format(day, 'd')}
                      </span>

                      {/* Attendance dot */}
                      {att && (
                        <div className="flex items-center gap-0.5 mb-0.5">
                          <span className="text-[9px] text-muted-foreground">{att.checked_out + att.checked_in}명 출근</span>
                        </div>
                      )}

                      {/* Leave events (max 2 shown) */}
                      {events.slice(0, 2).map(e => (
                        <div
                          key={e.id}
                          className={cn(
                            'text-[9px] leading-tight px-1 py-0.5 rounded truncate border mb-0.5',
                            statusColors[e.status] || ''
                          )}
                        >
                          {e.user_name} {leaveTypeLabels[e.leave_type] || e.leave_type}
                        </div>
                      ))}
                      {events.length > 2 && (
                        <span className="text-[9px] text-muted-foreground">+{events.length - 2}건</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-amber-500/20 border border-amber-300" />
                  대기중
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/20 border border-emerald-300" />
                  승인됨
                </div>
              </div>
            </div>

            {/* Detail Panel */}
            {selectedDate && (
              <div className="w-72 border rounded-lg p-3 bg-muted/30 shrink-0">
                <h4 className="text-sm font-semibold mb-3">
                  {format(selectedDate, 'M월 d일 (EEEE)', { locale: ko })}
                </h4>

                {/* Attendance summary */}
                {selectedAttendance ? (
                  <div className="mb-4 p-2 bg-card rounded border text-xs space-y-1">
                    <p className="font-medium text-sm mb-1">출퇴근 현황</p>
                    <p>출근: <span className="font-semibold">{selectedAttendance.checked_in + selectedAttendance.checked_out}명</span></p>
                    {selectedAttendance.checked_in > 0 && <p>근무 중: {selectedAttendance.checked_in}명</p>}
                    {selectedAttendance.checked_out > 0 && <p>퇴근 완료: {selectedAttendance.checked_out}명</p>}
                    {selectedAttendance.absent > 0 && <p className="text-destructive">결근: {selectedAttendance.absent}명</p>}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mb-4">출퇴근 기록 없음</p>
                )}

                {/* Leave events */}
                <p className="text-sm font-medium mb-2">휴가/일정 ({selectedDateEvents.length}건)</p>
                {selectedDateEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">등록된 일정이 없습니다.</p>
                ) : (
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {selectedDateEvents.map(e => (
                        <div key={e.id} className="p-2 bg-card rounded border text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{e.user_name}</span>
                            <Badge
                              variant="outline"
                              className={cn('text-[10px] border', statusColors[e.status] || '')}
                            >
                              {e.status === 'pending' ? '대기' : '승인'}
                            </Badge>
                          </div>
                          <p>{leaveTypeLabels[e.leave_type] || e.leave_type} · {e.days}일</p>
                          <p className="text-muted-foreground">
                            {e.start_date}{e.start_date !== e.end_date ? ` ~ ${e.end_date}` : ''}
                          </p>
                          {e.reason && <p className="text-muted-foreground">사유: {e.reason}</p>}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AttendanceCalendarView;
