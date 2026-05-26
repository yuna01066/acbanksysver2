import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { addDays, format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Loader2,
  UsersRound,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { BrandedCardHeader } from '@/components/ui/branded-card-header';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isMissingMeetingReservationsTableError } from '@/lib/meetingReservationErrors';
import { cn } from '@/lib/utils';
import MeetingBookingWidget from '@/components/MeetingBookingWidget';
import {
  MEETING_STATUS_LABELS,
  getMeetingTypeLabel,
  type ClientMeetingType,
  type EmployeeMeetingType,
  type MeetingAudienceType,
  type MeetingReservationStatus,
} from '@/types/meetingReservations';

interface DashboardMeetingReservation {
  id: string;
  audience_type: MeetingAudienceType | string;
  employee_meeting_type: EmployeeMeetingType | string | null;
  client_meeting_type: ClientMeetingType | string | null;
  title: string;
  meeting_date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  status: MeetingReservationStatus | string;
  participant_ids: string[];
  created_by: string;
  client_name: string | null;
}

const supabaseAny = supabase as any;
const todayString = () => format(new Date(), 'yyyy-MM-dd');
const plusDaysString = (days: number) => format(addDays(new Date(), days), 'yyyy-MM-dd');

function formatMeetingDateLabel(value: string) {
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, 'M월 d일 (EEE)', { locale: ko });
}

function formatMeetingTime(startTime: string, endTime: string | null) {
  return endTime ? `${startTime}~${endTime}` : startTime;
}

const DashboardMeetingBookingCard = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isModerator, isManager } = useAuth();
  const canManageMeetings = isAdmin || isModerator || isManager;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetAudience, setSheetAudience] = useState<MeetingAudienceType>('client');

  const { data: meetings = [], isLoading } = useQuery<DashboardMeetingReservation[]>({
    queryKey: ['dashboard-meeting-booking-card', user?.id, canManageMeetings],
    queryFn: async () => {
      let query = supabaseAny
        .from('meeting_reservations')
        .select('id, audience_type, employee_meeting_type, client_meeting_type, title, meeting_date, start_time, end_time, location, status, participant_ids, created_by, client_name')
        .gte('meeting_date', todayString())
        .lte('meeting_date', plusDaysString(7))
        .in('status', ['scheduled', 'confirmed'])
        .order('meeting_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(8);

      if (!canManageMeetings && user?.id) {
        query = query.or(`created_by.eq.${user.id},participant_ids.cs.{${user.id}},employee_meeting_type.eq.all_hands`);
      }

      const { data, error } = await query;
      if (error) {
        if (isMissingMeetingReservationsTableError(error)) return [];
        throw error;
      }
      return ((data || []) as unknown) as DashboardMeetingReservation[];
    },
    enabled: !!user,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const summary = useMemo(() => {
    const today = todayString();
    return {
      todayCount: meetings.filter((meeting) => meeting.meeting_date === today).length,
      weekCount: meetings.length,
      scheduledCount: meetings.filter((meeting) => meeting.status === 'scheduled').length,
      confirmedCount: meetings.filter((meeting) => meeting.status === 'confirmed').length,
      nextMeeting: meetings[0],
    };
  }, [meetings]);

  const openSheet = (audience: MeetingAudienceType) => {
    setSheetAudience(audience);
    setSheetOpen(true);
  };

  const nextMeeting = summary.nextMeeting;
  const nextTypeLabel = nextMeeting
    ? getMeetingTypeLabel(
      nextMeeting.audience_type as MeetingAudienceType,
      nextMeeting.employee_meeting_type as EmployeeMeetingType | null,
      nextMeeting.client_meeting_type as ClientMeetingType | null,
    )
    : null;

  return (
    <>
      <Card className="h-full overflow-hidden border-[#e5e5e5] bg-white shadow-sm backdrop-blur">
        <CardHeader className="pb-3">
          <BrandedCardHeader
            icon={CalendarCheck}
            title="미팅 예약"
            subtitle="상담과 내부 회의를 대시보드에서 바로 등록합니다."
            iconWrapClassName="border-[#cacacb] bg-white text-[#111111]"
            actions={
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-2.5 text-xs font-semibold text-[#111111] hover:bg-[#f5f5f5] hover:text-[#111111]"
                onClick={() => navigate('/meeting-reservations')}
              >
                전체보기
              </Button>
            }
          />
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="rounded-xl border border-[#cacacb] bg-[#fafafa] p-3 text-[#111111]">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#cacacb] bg-white text-[#111111]">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold">다음 미팅</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#707072]">
                  {isLoading
                    ? '미팅 예약을 불러오는 중입니다.'
                    : nextMeeting
                    ? `${formatMeetingDateLabel(nextMeeting.meeting_date)} ${formatMeetingTime(nextMeeting.start_time, nextMeeting.end_time)} · ${nextMeeting.title}`
                    : '오늘 또는 7일 내 예정된 미팅이 없습니다.'}
                </p>
                {nextMeeting && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">
                      {nextTypeLabel}
                    </Badge>
                    <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">
                      {MEETING_STATUS_LABELS[nextMeeting.status as MeetingReservationStatus] || nextMeeting.status}
                    </Badge>
                    {(nextMeeting.client_name || nextMeeting.location) && (
                      <Badge variant="secondary" className="h-5 max-w-full truncate rounded-full px-2 text-[10px]">
                        {nextMeeting.client_name || nextMeeting.location}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              {[
                { label: '오늘', value: summary.todayCount },
                { label: '예약', value: summary.scheduledCount },
                { label: '확정', value: summary.confirmedCount },
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
              onClick={() => openSheet('client')}
            >
              <Building2 className="mr-2 h-4 w-4" />
              클라이언트 미팅 예약
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-10 justify-start rounded-xl text-sm"
                onClick={() => openSheet('employee')}
              >
                <UsersRound className="mr-2 h-4 w-4" />
                직원 미팅 예약
              </Button>
              <Button
                variant="outline"
                className="h-10 justify-start rounded-xl text-sm"
                onClick={() => navigate('/meeting-reservations')}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                예약 관리
              </Button>
            </div>
          </div>

          <div className={cn('rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground', summary.weekCount > 0 && 'bg-background/70')}>
            7일 내 미팅 {summary.weekCount}건을 기준으로 표시합니다.
          </div>
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="!w-full overflow-y-auto overflow-x-hidden p-0 sm:!max-w-[980px]">
          <div className="border-b px-5 py-4">
            <SheetHeader>
              <SheetTitle>미팅 예약</SheetTitle>
              <SheetDescription>
                {sheetAudience === 'client' ? '클라이언트 상담 일정을 바로 등록합니다.' : '직원 미팅 일정을 바로 등록합니다.'}
              </SheetDescription>
            </SheetHeader>
          </div>
          <div className="p-4 sm:p-5">
            <MeetingBookingWidget
              key={sheetAudience}
              compactLayout
              showHeader={false}
              defaultAudienceType={sheetAudience}
              maxItems={6}
              className="max-w-full overflow-hidden rounded-[20px] border-[#e5e5e5] shadow-none"
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default DashboardMeetingBookingCard;
