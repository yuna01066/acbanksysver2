import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNotionProjects } from '@/hooks/useNotionProjects';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, FileText, Truck, BookOpen, Coffee, PartyPopper, Users, User, Cake, Calendar, FolderOpen, AlertCircle, Palmtree } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameMonth, isToday, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { BrandedCardHeader } from '@/components/ui/branded-card-header';

interface CalendarEvent {
  id: string;
  projectName: string;
  type: 'quote' | 'delivery' | 'notion' | 'meeting' | 'holiday' | 'birthday' | 'announcement_meeting' | 'announcement_conference' | 'project' | 'announcement_event' | 'leave';
  date: Date;
  userId: string;
  url?: string;
  assignee?: string;
  assigneeIds?: string[];
}

const DashboardCalendar = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, isModerator } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'my'>('all');

  const { data: quotes } = useQuery({
    queryKey: ['calendar-quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_quotes')
        .select('id, project_name, quote_date, desired_delivery_date, quote_number, user_id, project_id, project_stage, projects(status)')
        .order('quote_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: notionProjects = [] } = useNotionProjects({
    enabled: !!user,
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

  const { data: birthdays } = useQuery({
    queryKey: ['employee-birthdays'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, birthday')
        .eq('is_approved', true)
        .not('birthday', 'is', null);
      if (error) throw error;
      return data;
    },
  });

  const { data: announcementMeetings } = useQuery({
    queryKey: ['announcement-meetings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('id, title, author_id, meeting_date, meeting_time, meeting_location, announcement_type, event_end_date, recipient_name, assignee_ids')
        .in('announcement_type', ['meeting', 'conference', 'event'])
        .not('meeting_date', 'is', null);
      if (error) throw error;
      return data;
    },
  });

  const { data: managedProjects } = useQuery({
    queryKey: ['calendar-managed-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, status, created_at, user_id');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: projectAssignments } = useQuery({
    queryKey: ['calendar-project-assignments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_assignments')
        .select('project_id, user_id');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: leaveRequests } = useQuery({
    queryKey: ['calendar-leave-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('id, user_id, user_name, leave_type, start_date, end_date, days, status')
        .eq('status', 'approved');
      if (error) throw error;
      return data;
    },
  });

  const events = useMemo(() => {
    if (!quotes && !notionProjects && !meetings && !holidays && !birthdays && !announcementMeetings && !managedProjects && !leaveRequests) return [];
    const result: CalendarEvent[] = [];

    // 휴일 이벤트
    holidays?.forEach((h) => {
      const start = new Date(h.start_date);
      const end = new Date(h.end_date);
      const days = eachDayOfInterval({ start, end });
      days.forEach(d => {
        result.push({
          id: h.id,
          projectName: h.name,
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
        // 취소된 프로젝트 또는 취소된 견적서의 납기 희망일은 표시하지 않음
        const projectStatus = (q as { projects?: { status?: string } | null }).projects?.status;
        if (projectStatus === 'cancelled' || q.project_stage === 'cancelled') return;
        
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
    notionProjects?.forEach((project) => {
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
    meetings?.forEach((m) => {
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

    // 생일 이벤트
    birthdays?.forEach((p) => {
      if (p.birthday) {
        // birthday format: YYYY-MM-DD or MM-DD
        const parts = p.birthday.split('-');
        const month = parts.length >= 3 ? parseInt(parts[1]) - 1 : parseInt(parts[0]) - 1;
        const day = parts.length >= 3 ? parseInt(parts[2]) : parseInt(parts[1]);
        const year = currentMonth.getFullYear();
        const birthdayDate = new Date(year, month, day);
        if (!isNaN(birthdayDate.getTime())) {
          result.push({
            id: `birthday-${p.id}`,
            projectName: p.full_name,
            type: 'birthday',
            date: birthdayDate,
            userId: p.id,
          });
        }
      }
    });

    // 회의/미팅/이벤트 공지 이벤트
    announcementMeetings?.forEach((am) => {
      if (am.meeting_date) {
        if (am.announcement_type === 'event' && am.event_end_date) {
          // Multi-day event
          const start = new Date(am.meeting_date);
          const end = new Date(am.event_end_date);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            const eventDays = eachDayOfInterval({ start, end });
            eventDays.forEach(d => {
              result.push({
                id: am.id,
                projectName: am.title,
                type: 'announcement_event',
                date: d,
                userId: am.author_id || '',
              });
            });
          }
        } else if (am.announcement_type === 'event') {
          // Single-day event
          const date = new Date(am.meeting_date);
          if (!isNaN(date.getTime())) {
            result.push({
              id: am.id,
              projectName: am.title,
              type: 'announcement_event',
              date,
              userId: am.author_id || '',
            });
          }
        } else if (am.announcement_type === 'conference') {
          // 회의
          const date = new Date(am.meeting_date);
          if (!isNaN(date.getTime())) {
            result.push({
              id: am.id,
              projectName: `${am.title}${am.meeting_time ? ` ${am.meeting_time}` : ''}`,
              type: 'announcement_conference',
              date,
              userId: am.author_id || '',
            });
          }
        } else {
          // 미팅
          const date = new Date(am.meeting_date);
          if (!isNaN(date.getTime())) {
            result.push({
              id: am.id,
              projectName: `${am.title}${am.recipient_name ? ` (${am.recipient_name})` : ''}${am.meeting_time ? ` ${am.meeting_time}` : ''}`,
              type: 'announcement_meeting',
              date,
              userId: am.author_id || '',
              assigneeIds: am.assignee_ids || [],
            });
          }
        }
      }
    });

    // 프로젝트 관리 이벤트
    managedProjects?.forEach((p) => {
      if (p.created_at) {
        const date = new Date(p.created_at);
        if (!isNaN(date.getTime())) {
          result.push({
            id: p.id,
            projectName: p.name,
            type: 'project',
            date,
            userId: p.user_id,
          });
        }
      }
    });

    // 휴가 이벤트
    leaveRequests?.forEach((lr) => {
      const start = new Date(lr.start_date);
      const end = new Date(lr.end_date);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const leaveDays = eachDayOfInterval({ start, end });
        leaveDays.forEach(d => {
          result.push({
            id: `leave-${lr.id}`,
            projectName: `🌴 ${lr.user_name}`,
            type: 'leave',
            date: d,
            userId: lr.user_id,
          });
        });
      }
    });

    return result;
  }, [quotes, notionProjects, meetings, holidays, birthdays, announcementMeetings, managedProjects, leaveRequests, user, currentMonth]);

  // Filter events based on view mode
  const filteredEvents = useMemo(() => {
    if (viewMode === 'all') return events;
    if (!user) return events;
    const myName = profile?.full_name || '';
    const myAssignedProjectIds = new Set(
      projectAssignments?.filter(a => a.user_id === user.id).map(a => a.project_id) || []
    );
    return events.filter(e => {
      // Always show holidays, birthdays, leaves
      if (e.type === 'holiday') return true;
      if (e.type === 'birthday') return true;
      if (e.type === 'leave') return e.userId === user.id;
      if (e.type === 'announcement_meeting') return e.userId === user.id || (e.assigneeIds || []).includes(user.id);
      if (e.type === 'announcement_conference') return true;
      if (e.type === 'announcement_event') return true;
      // Meetings are already filtered to current user
      if (e.type === 'meeting') return true;
      // Quotes/deliveries: only show mine
      if (e.type === 'quote' || e.type === 'delivery') return e.userId === user.id;
      // Notion: fuzzy match assignee with my name
      if (e.type === 'notion') {
        if (!e.assignee || !myName) return false;
        return e.assignee.includes(myName) || myName.includes(e.assignee);
      }
      // Projects: show if creator or assigned
      if (e.type === 'project') {
        return e.userId === user.id || myAssignedProjectIds.has(e.id);
      }
      return true;
    });
  }, [events, viewMode, user, profile, projectAssignments]);

  const handleEventClick = useCallback((event: CalendarEvent) => {
    if (event.type === 'notion') {
      if (event.url) {
        window.open(event.url, '_blank');
      }
      return;
    }
    if (event.type === 'announcement_meeting' || event.type === 'announcement_conference' || event.type === 'announcement_event') {
      navigate(`/announcements?focus=${event.id}`);
      return;
    }
    if (event.type === 'project') {
      navigate(`/project-management?id=${event.id}`);
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

  const getEventsForDay = (day: Date) => {
    const dayEvts = filteredEvents.filter((e) => isSameDay(e.date, day));
    // Sort: announcement_event first, then holiday, then rest
    return dayEvts.sort((a, b) => {
      const priority = (t: string) => {
        switch (t) {
          case 'holiday': return 0;
          case 'birthday': return 1;
          case 'leave': return 2;
          case 'announcement_event': return 3;
          case 'delivery': return 4;
          case 'announcement_conference': return 5;
          case 'announcement_meeting': return 6;
          case 'meeting': return 7;
          case 'project': return 8;
          case 'quote': return 9;
          case 'notion': return 10;
          default: return 11;
        }
      };
      return priority(a.type) - priority(b.type);
    });
  };

  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <BrandedCardHeader
          icon={Calendar}
          title="프로젝트 캘린더"
          meta={
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'all' | 'my')} className="h-8">
              <TabsList className="h-8 p-0.5">
                <TabsTrigger value="all" className="h-7 text-xs gap-1 px-2.5">
                  <Users className="h-3.5 w-3.5" /> 전체
                </TabsTrigger>
                <TabsTrigger value="my" className="h-7 text-xs gap-1 px-2.5">
                  <User className="h-3.5 w-3.5" /> 내 일정
                </TabsTrigger>
              </TabsList>
            </Tabs>
          }
          actions={
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
          }
        />
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
            <Users className="h-3 w-3 text-blue-600" /> 회의
          </span>
          <span className="flex items-center gap-1">
            <Coffee className="h-3 w-3 text-amber-600" /> 미팅
          </span>
          <span className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3 text-emerald-500" /> 이벤트
          </span>
          <span className="flex items-center gap-1">
            <PartyPopper className="h-3 w-3 text-red-500" /> 휴일
          </span>
          <span className="flex items-center gap-1">
            <Cake className="h-3 w-3 text-pink-500" /> 생일
          </span>
          <span className="flex items-center gap-1">
            <FolderOpen className="h-3 w-3 text-emerald-600" /> 프로젝트
          </span>
          <span className="flex items-center gap-1">
            <Palmtree className="h-3 w-3 text-teal-500" /> 휴가
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
            const hasAnnouncementEvent = dayEvents.some(e => e.type === 'announcement_event');
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[80px] border-t border-border/30 p-1 transition-colors",
                  isToday(day) && "bg-primary/5",
                  hasAnnouncementEvent && !isToday(day) && !hasHoliday && "bg-emerald-50 dark:bg-emerald-950/20",
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
                      onClick={() => event.type !== 'holiday' && event.type !== 'birthday' && event.type !== 'leave' && handleEventClick(event)}
                      className={cn(
                        "w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded truncate flex items-center gap-0.5 hover:opacity-80 transition-opacity",
                        event.type === 'quote'
                          ? "bg-primary/10 text-primary"
                          : event.type === 'delivery'
                          ? "bg-orange-500/10 text-orange-600"
                      : event.type === 'meeting'
                          ? "bg-amber-500/10 text-amber-700"
                          : event.type === 'announcement_conference'
                          ? "bg-blue-500/10 text-blue-700 cursor-pointer"
                          : event.type === 'announcement_meeting'
                          ? "bg-amber-500/10 text-amber-700 cursor-pointer"
                          : event.type === 'announcement_event'
                          ? "bg-emerald-500/10 text-emerald-600 cursor-pointer"
                          : event.type === 'holiday'
                          ? "bg-red-500/10 text-red-600 cursor-default"
                          : event.type === 'birthday'
                          ? "bg-pink-500/10 text-pink-600 cursor-default"
                          : event.type === 'leave'
                          ? "bg-teal-500/10 text-teal-600 cursor-default"
                          : event.type === 'project'
                          ? "bg-emerald-500/10 text-emerald-700 cursor-pointer"
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
                      ) : event.type === 'announcement_conference' ? (
                        <Users className="h-2.5 w-2.5 shrink-0" />
                      ) : event.type === 'announcement_meeting' ? (
                        <Coffee className="h-2.5 w-2.5 shrink-0" />
                      ) : event.type === 'announcement_event' ? (
                        <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                      ) : event.type === 'holiday' ? (
                        <PartyPopper className="h-2.5 w-2.5 shrink-0" />
                      ) : event.type === 'birthday' ? (
                        <Cake className="h-2.5 w-2.5 shrink-0" />
                      ) : event.type === 'leave' ? (
                        <Palmtree className="h-2.5 w-2.5 shrink-0" />
                      ) : event.type === 'project' ? (
                        <FolderOpen className="h-2.5 w-2.5 shrink-0" />
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
