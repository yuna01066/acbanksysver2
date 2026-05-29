import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, format } from 'date-fns';
import { Building2, CalendarCheck, Clock3, DoorOpen, UsersRound } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BrandedCardHeader } from '@/components/ui/branded-card-header';
import CalendarEventDialog from '@/components/calendar/CalendarEventDialog';
import { useAuth } from '@/contexts/AuthContext';
import {
  useCalendarDashboardSummary,
  useCalendarEvents,
} from '@/hooks/useInternalCalendar';
import type { CalendarViewScope } from '@/types/internalCalendar';

const DashboardMeetingBookingCard = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isModerator } = useAuth();
  const canViewAll = isAdmin || isModerator;
  const scope: CalendarViewScope = canViewAll ? 'all' : 'my';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'employee' | 'client' | 'room' | 'manual'>('client');
  const rangeStart = new Date().toISOString();
  const rangeEnd = addDays(new Date(), 14).toISOString();

  const { data: events = [] } = useCalendarEvents({
    rangeStart,
    rangeEnd,
    scope,
    enabled: !!user,
  });
  const { data: summary, isLoading } = useCalendarDashboardSummary({
    rangeStart,
    rangeEnd,
    scope,
    enabled: !!user,
  });

  const nextMeeting = useMemo(() => {
    return events
      .filter((event) =>
        event.source_type === 'meeting_reservation'
        || event.source_type === 'peer_meeting'
        || event.client_name
        || event.metadata?.calendar_kind === 'employee'
        || event.metadata?.calendar_kind === 'client',
      )
      .filter((event) => new Date(event.ends_at).getTime() >= Date.now())
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];
  }, [events]);

  const openDialog = (mode: 'employee' | 'client' | 'room' | 'manual') => {
    setDialogMode(mode);
    setDialogOpen(true);
  };

  return (
    <>
      <Card className="h-full overflow-hidden border-[#e5e5e5] bg-white shadow-sm backdrop-blur">
        <CardHeader className="pb-3">
          <BrandedCardHeader
            icon={CalendarCheck}
            title="빠른 예약"
            subtitle="미팅과 회의실을 캘린더에 바로 등록합니다."
            iconWrapClassName="border-[#cacacb] bg-white text-[#111111]"
            actions={
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-2.5 text-xs font-semibold text-[#111111] hover:bg-[#f5f5f5] hover:text-[#111111]"
                onClick={() => navigate('/calendar')}
              >
                캘린더
              </Button>
            }
          />
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="rounded-xl border border-[#cacacb] bg-[#fafafa] p-3 text-[#111111]">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#cacacb] bg-white text-[#111111]">
                <Clock3 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold">다음 미팅</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#707072]">
                  {isLoading
                    ? '캘린더를 불러오는 중입니다.'
                    : nextMeeting
                    ? `${format(new Date(nextMeeting.starts_at), 'M월 d일 HH:mm')} · ${nextMeeting.title}`
                    : '14일 내 예정된 미팅이 없습니다.'}
                </p>
                {nextMeeting && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">
                      {nextMeeting.client_name ? '클라이언트' : '직원 미팅'}
                    </Badge>
                    {(nextMeeting.location || nextMeeting.resource_names.length > 0) && (
                      <Badge variant="secondary" className="h-5 max-w-full truncate rounded-full px-2 text-[10px]">
                        {nextMeeting.location || nextMeeting.resource_names.join(', ')}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              {[
                { label: '오늘', value: summary?.today_count || 0 },
                { label: '담당', value: summary?.assigned_meeting_count || 0 },
                { label: '회의실', value: summary?.rooms_in_use_count || 0 },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-[#e5e5e5] bg-white px-2 py-1.5">
                  <p className="font-bold">{item.value}</p>
                  <p className="text-[10px] text-[#707072]">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Button
              className="h-10 justify-start rounded-xl bg-[#111111] text-sm font-semibold text-white hover:bg-[#39393b]"
              onClick={() => openDialog('client')}
            >
              <Building2 className="mr-2 h-4 w-4" />
              클라이언트 미팅 예약
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-10 justify-start rounded-xl text-sm"
                onClick={() => openDialog('employee')}
              >
                <UsersRound className="mr-2 h-4 w-4" />
                직원 미팅
              </Button>
              <Button
                variant="outline"
                className="h-10 justify-start rounded-xl text-sm"
                onClick={() => openDialog('room')}
              >
                <DoorOpen className="mr-2 h-4 w-4" />
                회의실
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <CalendarEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        events={events}
        defaultDate={format(new Date(), 'yyyy-MM-dd')}
        defaultMode={dialogMode}
      />
    </>
  );
};

export default DashboardMeetingBookingCard;
