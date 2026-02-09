import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, FileText, Truck, BookOpen, Coffee, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameMonth, isToday, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';

interface CalendarEvent {
  id: string;
  projectName: string;
  type: 'quote' | 'delivery' | 'notion' | 'meeting' | 'holiday';
  date: Date;
  userId: string;
  url?: string;
  assignee?: string;
}

const DashboardCalendar = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isModerator } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const { data: quotes } = useQuery({
    queryKey: ['calendar-quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_quotes')
        .select('id, project_name, quote_date, desired_delivery_date, quote_number, user_id')
        .order('quote_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: notionProjects } = useQuery({
    queryKey: ['notion-projects'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('notion-projects');
      if (error) {
        console.error('Notion fetch error:', error);
        return [];
      }
      return data?.projects || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: meetings } = useQuery({
    queryKey: ['calendar-meetings', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('peer_feedback')
        .select('id, sender_id, receiver_id, message, meeting_date, meeting_time, meeting_status, created_at')
        .eq('feedback_type', 'meeting')
        .in('meeting_status', ['accepted', 'rescheduled'])
        .not('meeting_date', 'is', null)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const participantIds = [...new Set(data.flatMap(m => [m.sender_id, m.receiver_id]))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', participantIds);
      const nameMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      return data.map(m => ({ ...m, sender_name: nameMap.get(m.sender_id) || '?', receiver_name: nameMap.get(m.receiver_id) || '?' }));
    },
    enabled: !!user,
  });

  const { data: holidays } = useQuery({
    queryKey: ['company-holidays'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_holidays')
        .select('*')
        .order('start_date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const events = useMemo(() => {
    if (!quotes && !notionProjects && !meetings && !holidays) return [];
    const result: CalendarEvent[] = [];

    // 휴일 이벤트
    holidays?.forEach((h: any) => {
      const start = new Date(h.start_date);
      const end = new Date(h.end_date);
      const days = eachDayOfInterval({ start, end });
      days.forEach(d => {
        result.push({
          id: h.id,
          projectName: `🎌 ${h.name}`,
          type: 'holiday',
          date: d,
          userId: '',
        });
      });
    });

    // 견적 이벤트
    quotes?.forEach((q) => {
      if (q.quote_date) {
        result.push({
          id: q.id,
          projectName: q.project_name || `견적 ${q.quote_number}`,
          type: 'quote',
          date: new Date(q.quote_date),
          userId: q.user_id,
        });
      }
      if (q.desired_delivery_date) {
        const deliveryDate = new Date(q.desired_delivery_date);
        if (!isNaN(deliveryDate.getTime())) {
          result.push({
            id: q.id,
            projectName: q.project_name || `견적 ${q.quote_number}`,
            type: 'delivery',
            date: deliveryDate,
            userId: q.user_id,
          });
        }
      }
    });

    // Notion 프로젝트 이벤트
    notionProjects?.forEach((project: any) => {
      const dateStr = project.date || project.createdDate;
      if (dateStr) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          result.push({
            id: project.id,
            projectName: project.title || 'Untitled',
            type: 'notion',
            date,
            userId: '',
            url: project.url,
            assignee: project.assignee,
          });
        }
      }
    });

    // 미팅 이벤트
    meetings?.forEach((m: any) => {
      if (m.meeting_date) {
        const date = new Date(m.meeting_date);
        if (!isNaN(date.getTime())) {
          result.push({
            id: m.id,
            projectName: `☕ ${m.sender_name} ↔ ${m.receiver_name}${m.meeting_time ? ` ${m.meeting_time}` : ''}`,
            type: 'meeting',
            date,
            userId: m.sender_id === user?.id ? m.receiver_id : m.sender_id,
          });
        }
      }
    });

    return result;
  }, [quotes, notionProjects, meetings, holidays, user]);

  const handleEventClick = useCallback((event: CalendarEvent) => {
    if (event.type === 'notion') {
      if (event.url) {
        window.open(event.url, '_blank');
      }
      return;
    }
    if (isAdmin || isModerator || event.userId === user?.id) {
      navigate(`/saved-quotes/${event.id}`);
    } else {
      toast.error('접근 권한이 없습니다. 본인이 발행한 견적서만 열람할 수 있습니다.');
    }
  }, [isAdmin, isModerator, user, navigate]);

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
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3 text-primary" /> 견적 발행일
          </span>
          <span className="flex items-center gap-1">
            <Truck className="h-3 w-3 text-orange-500" /> 납기 희망일
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3 text-violet-500" /> Notion 프로젝트
          </span>
          <span className="flex items-center gap-1">
            <Coffee className="h-3 w-3 text-amber-600" /> 1:1 미팅
          </span>
          <span className="flex items-center gap-1">
            <PartyPopper className="h-3 w-3 text-red-500" /> 휴일
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
            const hasHoliday = dayEvents.some(e => e.type === 'holiday');
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[80px] border-t border-border/30 p-1 transition-colors",
                  isToday(day) && "bg-primary/5",
                  hasHoliday && !isToday(day) && "bg-red-50 dark:bg-red-950/20",
                  !isSameMonth(day, currentMonth) && "opacity-40"
                )}
              >
                <span className={cn(
                  "text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full",
                  isToday(day) && "bg-primary text-primary-foreground",
                  hasHoliday && !isToday(day) && "text-red-500",
                  dayOfWeek === 0 && !isToday(day) && !hasHoliday && "text-red-500",
                  dayOfWeek === 6 && !isToday(day) && !hasHoliday && "text-blue-500"
                )}>
                  {format(day, 'd')}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {(expandedDay === day.toISOString() ? dayEvents : dayEvents.slice(0, 3)).map((event, idx) => (
                    <button
                      key={`${event.id}-${event.type}-${idx}`}
                      onClick={() => event.type !== 'holiday' && handleEventClick(event)}
                      className={cn(
                        "w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded truncate flex items-center gap-0.5 hover:opacity-80 transition-opacity",
                        event.type === 'quote'
                          ? "bg-primary/10 text-primary"
                          : event.type === 'delivery'
                          ? "bg-orange-500/10 text-orange-600"
                          : event.type === 'meeting'
                          ? "bg-amber-500/10 text-amber-700"
                          : event.type === 'holiday'
                          ? "bg-red-500/10 text-red-600 cursor-default"
                          : "bg-violet-500/10 text-violet-600"
                      )}
                      title={event.projectName}
                    >
                      {event.type === 'quote' ? (
                        <FileText className="h-2.5 w-2.5 shrink-0" />
                      ) : event.type === 'delivery' ? (
                        <Truck className="h-2.5 w-2.5 shrink-0" />
                      ) : event.type === 'meeting' ? (
                        <Coffee className="h-2.5 w-2.5 shrink-0" />
                      ) : event.type === 'holiday' ? (
                        <PartyPopper className="h-2.5 w-2.5 shrink-0" />
                      ) : (
                        <BookOpen className="h-2.5 w-2.5 shrink-0" />
                      )}
                      <span className="truncate">{event.projectName}</span>
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <button
                      className="text-[10px] text-muted-foreground px-1 hover:text-foreground transition-colors cursor-pointer"
                      onClick={() => setExpandedDay(expandedDay === day.toISOString() ? null : day.toISOString())}
                    >
                      {expandedDay === day.toISOString() ? '접기' : `+${dayEvents.length - 3}건`}
                    </button>
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
