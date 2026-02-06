import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, FileText, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameMonth, isToday, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';

interface CalendarEvent {
  id: string;
  projectName: string;
  type: 'quote' | 'delivery';
  date: Date;
}

const DashboardCalendar = () => {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: quotes } = useQuery({
    queryKey: ['calendar-quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_quotes')
        .select('id, project_name, quote_date, desired_delivery_date, quote_number')
        .order('quote_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const events = useMemo(() => {
    if (!quotes) return [];
    const result: CalendarEvent[] = [];
    quotes.forEach((q) => {
      if (q.quote_date) {
        result.push({
          id: q.id,
          projectName: q.project_name || `견적 ${q.quote_number}`,
          type: 'quote',
          date: new Date(q.quote_date),
        });
      }
      if (q.desired_delivery_date) {
        result.push({
          id: q.id,
          projectName: q.project_name || `견적 ${q.quote_number}`,
          type: 'delivery',
          date: new Date(q.desired_delivery_date),
        });
      }
    });
    return result;
  }, [quotes]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const getEventsForDay = (day: Date) =>
    events.filter((e) => isSameDay(e.date, day));

  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">프로젝트 캘린더</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {format(currentMonth, 'yyyy년 M월', { locale: ko })}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3 text-primary" /> 견적 발행일
          </span>
          <span className="flex items-center gap-1">
            <Truck className="h-3 w-3 text-orange-500" /> 납기 희망일
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Week day headers */}
        <div className="grid grid-cols-7 mb-1">
          {weekDays.map((d, i) => (
            <div key={d} className={cn(
              "text-center text-xs font-medium py-1",
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"
            )}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {/* Empty cells for offset */}
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] border-t border-border/30 p-1" />
          ))}

          {days.map((day) => {
            const dayEvents = getEventsForDay(day);
            const dayOfWeek = getDay(day);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[80px] border-t border-border/30 p-1 transition-colors",
                  isToday(day) && "bg-primary/5",
                  !isSameMonth(day, currentMonth) && "opacity-40"
                )}
              >
                <span className={cn(
                  "text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full",
                  isToday(day) && "bg-primary text-primary-foreground",
                  dayOfWeek === 0 && !isToday(day) && "text-red-500",
                  dayOfWeek === 6 && !isToday(day) && "text-blue-500"
                )}>
                  {format(day, 'd')}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {dayEvents.slice(0, 3).map((event, idx) => (
                    <button
                      key={`${event.id}-${event.type}-${idx}`}
                      onClick={() => navigate(`/saved-quotes/${event.id}`)}
                      className={cn(
                        "w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded truncate flex items-center gap-0.5 hover:opacity-80 transition-opacity",
                        event.type === 'quote'
                          ? "bg-primary/10 text-primary"
                          : "bg-orange-500/10 text-orange-600"
                      )}
                      title={`${event.projectName} (${event.type === 'quote' ? '견적 발행일' : '납기 희망일'})`}
                    >
                      {event.type === 'quote' ? (
                        <FileText className="h-2.5 w-2.5 shrink-0" />
                      ) : (
                        <Truck className="h-2.5 w-2.5 shrink-0" />
                      )}
                      <span className="truncate">{event.projectName}</span>
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[10px] text-muted-foreground px-1">
                      +{dayEvents.length - 3}건
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default DashboardCalendar;
