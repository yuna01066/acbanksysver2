import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  Plus,
  Search,
  UsersRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  CLIENT_MEETING_OPTIONS,
  EMPLOYEE_MEETING_OPTIONS,
  MEETING_AUDIENCE_OPTIONS,
  MEETING_STATUS_CLASSES,
  MEETING_STATUS_LABELS,
  getMeetingTypeLabel,
  type ClientMeetingType,
  type EmployeeMeetingType,
  type MeetingAudienceType,
  type MeetingReservationStatus,
} from '@/types/meetingReservations';

type MeetingReservationRow = any;
type MeetingReservationInsert = any;
const supabaseAny = supabase as any;

type EmployeeOption = {
  id: string;
  full_name: string;
  department: string | null;
  position: string | null;
};

type RecipientOption = {
  id: string;
  company_name: string;
  contact_person: string;
  phone: string;
};

interface MeetingBookingWidgetProps {
  className?: string;
  defaultAudienceType?: MeetingAudienceType;
  maxItems?: number;
  showHeader?: boolean;
  title?: string;
  description?: string;
}

const DURATION_OPTIONS = [30, 60, 90, 120];
const STATUS_OPTIONS: MeetingReservationStatus[] = ['scheduled', 'confirmed', 'completed', 'canceled'];

const TIME_OPTIONS = Array.from({ length: 21 }, (_, index) => {
  const totalMinutes = 9 * 60 + index * 30;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

const todayString = () => format(new Date(), 'yyyy-MM-dd');

const addMinutesToTime = (time: string, minutes: number) => {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date(2000, 0, 1, hour || 0, minute || 0);
  date.setMinutes(date.getMinutes() + minutes);
  return format(date, 'HH:mm');
};

const formatMeetingDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : format(date, 'M월 d일 (EEE)', { locale: ko });
};

const isTodayValue = (value: string) => value === todayString();

const MeetingBookingWidget = ({
  className,
  defaultAudienceType = 'employee',
  maxItems = 12,
  showHeader = true,
  title: widgetTitle = '미팅 예약 관리',
  description: widgetDescription = '직원 미팅과 클라이언트 상담 일정을 한 위젯에서 분리해 예약합니다.',
}: MeetingBookingWidgetProps) => {
  const { user, profile, isAdmin, isModerator, isManager } = useAuth();
  const queryClient = useQueryClient();
  const canManageAll = isAdmin || isModerator || isManager;
  const [audienceType, setAudienceType] = useState<MeetingAudienceType>(defaultAudienceType);
  const [employeeMeetingType, setEmployeeMeetingType] = useState<EmployeeMeetingType>('one_on_one');
  const [clientMeetingType, setClientMeetingType] = useState<ClientMeetingType>('showroom_visit');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(todayString());
  const [startTime, setStartTime] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [location, setLocation] = useState('');
  const [descriptionText, setDescriptionText] = useState('');
  const [recipientId, setRecipientId] = useState('none');
  const [clientName, setClientName] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [participantSearch, setParticipantSearch] = useState('');
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);

  const { data: employees = [], isLoading: isEmployeesLoading } = useQuery({
    queryKey: ['meeting-reservation-employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, department, position')
        .eq('is_approved', true)
        .order('full_name');
      if (error) throw error;
      return (data || []) as EmployeeOption[];
    },
    enabled: !!user,
  });

  const { data: recipients = [], isLoading: isRecipientsLoading } = useQuery({
    queryKey: ['meeting-reservation-recipients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipients')
        .select('id, company_name, contact_person, phone')
        .order('company_name');
      if (error) throw error;
      return (data || []) as RecipientOption[];
    },
    enabled: !!user,
  });

  const {
    data: reservations = [],
    isLoading: isReservationsLoading,
  } = useQuery({
    queryKey: ['meeting-reservations', maxItems],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('meeting_reservations')
        .select('*')
        .gte('meeting_date', todayString())
        .order('meeting_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(maxItems);
      if (error) throw error;
      return (data || []) as MeetingReservationRow[];
    },
    enabled: !!user,
  });

  const selectedRecipient = useMemo(
    () => recipients.find((recipient) => recipient.id === recipientId),
    [recipientId, recipients],
  );

  const selectedParticipantNames = useMemo(
    () =>
      selectedParticipantIds
        .map((id) => employees.find((employee) => employee.id === id)?.full_name)
        .filter(Boolean) as string[],
    [employees, selectedParticipantIds],
  );

  const visibleEmployees = useMemo(() => {
    const keyword = participantSearch.trim().toLowerCase();
    if (!keyword) return employees.slice(0, 8);
    return employees
      .filter((employee) =>
        [employee.full_name, employee.department, employee.position]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(keyword)),
      )
      .slice(0, 8);
  }, [employees, participantSearch]);

  const formError = useMemo(() => {
    if (!user || !profile) return '로그인 후 예약할 수 있습니다.';
    if (!meetingTitle.trim()) return '미팅 제목을 입력해주세요.';
    if (!meetingDate) return '미팅 날짜를 선택해주세요.';
    if (!startTime) return '시작 시간을 선택해주세요.';
    if (audienceType === 'employee' && employeeMeetingType === 'one_on_one' && selectedParticipantIds.length === 0) {
      return '1:1 미팅은 참석 직원을 1명 이상 선택해주세요.';
    }
    if (audienceType === 'client' && !selectedRecipient && !clientName.trim()) {
      return '클라이언트명 또는 거래처를 입력해주세요.';
    }
    return '';
  }, [
    audienceType,
    clientName,
    employeeMeetingType,
    meetingDate,
    meetingTitle,
    profile,
    selectedParticipantIds.length,
    selectedRecipient,
    startTime,
    user,
  ]);

  const resetForm = () => {
    setMeetingTitle('');
    setLocation('');
    setDescriptionText('');
    setRecipientId('none');
    setClientName('');
    setClientContact('');
    setParticipantSearch('');
    setSelectedParticipantIds([]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user || !profile) throw new Error('로그인 후 예약할 수 있습니다.');
      if (formError) throw new Error(formError);

      const isEmployeeMeeting = audienceType === 'employee';
      const payload: MeetingReservationInsert = {
        audience_type: audienceType,
        employee_meeting_type: isEmployeeMeeting ? employeeMeetingType : null,
        client_meeting_type: isEmployeeMeeting ? null : clientMeetingType,
        title: meetingTitle.trim(),
        description: descriptionText.trim() || null,
        meeting_date: meetingDate,
        start_time: startTime,
        end_time: addMinutesToTime(startTime, Number(durationMinutes)),
        location: location.trim() || null,
        status: 'scheduled',
        recipient_id: !isEmployeeMeeting && selectedRecipient ? selectedRecipient.id : null,
        client_name: !isEmployeeMeeting ? selectedRecipient?.company_name || clientName.trim() || null : null,
        client_contact: !isEmployeeMeeting ? clientContact.trim() || selectedRecipient?.contact_person || null : null,
        participant_ids: isEmployeeMeeting ? selectedParticipantIds : [],
        participant_names: isEmployeeMeeting ? selectedParticipantNames : [],
        created_by: user.id,
        created_by_name: profile.full_name || user.email || '담당자',
      };

      const { error } = await supabaseAny.from('meeting_reservations').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('미팅 예약이 등록되었습니다.');
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['meeting-reservations'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || '미팅 예약 등록에 실패했습니다.');
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MeetingReservationStatus }) => {
      const { error } = await supabaseAny.from('meeting_reservations').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-reservations'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || '상태 변경에 실패했습니다.');
    },
  });

  const toggleParticipant = (employeeId: string) => {
    setSelectedParticipantIds((prev) =>
      prev.includes(employeeId) ? prev.filter((id) => id !== employeeId) : [...prev, employeeId],
    );
  };

  const handleAudienceChange = (value: MeetingAudienceType) => {
    setAudienceType(value);
    setRecipientId('none');
    setClientName('');
    setClientContact('');
    setSelectedParticipantIds([]);
    setParticipantSearch('');
  };

  const upcomingCount = reservations.filter((reservation) => reservation.status !== 'canceled').length;
  const todayCount = reservations.filter(
    (reservation) => reservation.status !== 'canceled' && isTodayValue(reservation.meeting_date),
  ).length;
  const confirmedCount = reservations.filter((reservation) => reservation.status === 'confirmed').length;

  return (
    <section
      className={cn(
        'w-full max-w-[720px] rounded-xl border border-[#e5e5e5] bg-white text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.04)]',
        className,
      )}
    >
      {showHeader && (
        <header className="border-b border-[#e5e5e5] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-['Horizon',sans-serif] text-[11px] uppercase leading-none tracking-[0.02em] text-[#707072]">
                Meeting Scheduler
              </p>
              <h2 className="mt-2 text-xl font-bold leading-tight tracking-normal text-[#111111]">{widgetTitle}</h2>
              <p className="mt-1 max-w-xl text-sm leading-5 text-[#707072]">{widgetDescription}</p>
            </div>
            <Badge variant="outline" className="w-fit rounded-full border-[#cacacb] px-3 py-1 text-xs text-[#39393b]">
              독립 위젯
            </Badge>
          </div>
        </header>
      )}

      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1.06fr_0.94fr]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {MEETING_AUDIENCE_OPTIONS.map((option) => {
              const AudienceIcon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleAudienceChange(option.value)}
                  className={cn(
                    'flex min-h-[74px] items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                    audienceType === option.value
                      ? 'border-[#111111] bg-[#111111] text-white'
                      : 'border-[#cacacb] bg-white text-[#111111] hover:border-[#111111]',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
                      audienceType === option.value ? 'border-white/20 bg-white/10' : 'border-[#e5e5e5] bg-[#f5f5f5]',
                    )}
                  >
                    <AudienceIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-5">{option.label}</span>
                    <span
                      className={cn(
                        'mt-0.5 block text-xs leading-4',
                        audienceType === option.value ? 'text-white/70' : 'text-[#707072]',
                      )}
                    >
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-[#39393b]">미팅 유형</Label>
            <div className={cn('grid gap-2', audienceType === 'client' ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
              {(audienceType === 'employee' ? EMPLOYEE_MEETING_OPTIONS : CLIENT_MEETING_OPTIONS).map((option) => {
                const active =
                  audienceType === 'employee'
                    ? option.value === employeeMeetingType
                    : option.value === clientMeetingType;
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      if (audienceType === 'employee') {
                        setEmployeeMeetingType(option.value as EmployeeMeetingType);
                      } else {
                        setClientMeetingType(option.value as ClientMeetingType);
                      }
                    }}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-colors',
                      active
                        ? 'border-[#111111] bg-[#f5f5f5] text-[#111111]'
                        : 'border-[#e5e5e5] bg-white text-[#39393b] hover:border-[#cacacb]',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="text-sm font-semibold">{option.label}</span>
                    </div>
                    <p className="mt-1 text-xs leading-4 text-[#707072]">{option.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="meeting-title" className="text-xs font-semibold text-[#39393b]">
                제목
              </Label>
              <Input
                id="meeting-title"
                value={meetingTitle}
                onChange={(event) => setMeetingTitle(event.target.value)}
                placeholder={audienceType === 'employee' ? '예: 제작팀 주간 회의' : '예: 쇼룸 방문 제작 상담'}
                className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="meeting-date" className="text-xs font-semibold text-[#39393b]">
                날짜
              </Label>
              <Input
                id="meeting-date"
                type="date"
                value={meetingDate}
                min={todayString()}
                onChange={(event) => setMeetingDate(event.target.value)}
                className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
              />
            </div>

            <div className="grid grid-cols-[1fr_92px] gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#39393b]">시작</Label>
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger className="h-10 rounded-lg border-[#cacacb] bg-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#39393b]">길이</Label>
                <Select value={durationMinutes} onValueChange={setDurationMinutes}>
                  <SelectTrigger className="h-10 rounded-lg border-[#cacacb] bg-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((duration) => (
                      <SelectItem key={duration} value={String(duration)}>
                        {duration}분
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="meeting-location" className="text-xs font-semibold text-[#39393b]">
                장소
              </Label>
              <Input
                id="meeting-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder={audienceType === 'employee' ? '예: 2층 회의실' : '예: ACBANK 쇼룸, 클라이언트 현장'}
                className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
              />
            </div>
          </div>

          {audienceType === 'employee' ? (
            <div className="space-y-2 rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-semibold text-[#39393b]">참석 직원</Label>
                <span className="text-xs text-[#707072]">{selectedParticipantIds.length}명 선택</span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9e9ea0]" />
                <Input
                  value={participantSearch}
                  onChange={(event) => setParticipantSearch(event.target.value)}
                  placeholder="이름, 부서, 직책 검색"
                  className="h-9 rounded-full border-[#cacacb] bg-white pl-8 text-sm"
                />
              </div>
              <div className="grid max-h-40 gap-1.5 overflow-auto pr-1 sm:grid-cols-2">
                {isEmployeesLoading ? (
                  <div className="col-span-full flex items-center gap-2 rounded-lg border border-[#e5e5e5] bg-white p-3 text-sm text-[#707072]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    직원 목록을 불러오는 중
                  </div>
                ) : visibleEmployees.length > 0 ? (
                  visibleEmployees.map((employee) => {
                    const selected = selectedParticipantIds.includes(employee.id);
                    return (
                      <button
                        key={employee.id}
                        type="button"
                        onClick={() => toggleParticipant(employee.id)}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-left transition-colors',
                          selected
                            ? 'border-[#111111] bg-[#111111] text-white'
                            : 'border-[#e5e5e5] bg-white text-[#111111] hover:border-[#cacacb]',
                        )}
                      >
                        <span className="block truncate text-sm font-semibold">{employee.full_name}</span>
                        <span className={cn('block truncate text-xs', selected ? 'text-white/70' : 'text-[#707072]')}>
                          {[employee.department, employee.position].filter(Boolean).join(' / ') || '부서 미설정'}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="col-span-full rounded-lg border border-[#e5e5e5] bg-white p-3 text-sm text-[#707072]">
                    검색 결과가 없습니다.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#39393b]">거래처 선택</Label>
                <Select value={recipientId} onValueChange={setRecipientId}>
                  <SelectTrigger className="h-10 rounded-lg border-[#cacacb] bg-white text-sm">
                    <SelectValue placeholder="거래처 선택 또는 직접 입력" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">직접 입력</SelectItem>
                    {recipients.map((recipient) => (
                      <SelectItem key={recipient.id} value={recipient.id}>
                        {recipient.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isRecipientsLoading ? (
                <div className="flex items-center gap-2 text-xs text-[#707072]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  거래처 목록을 불러오는 중
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="client-name" className="text-xs font-semibold text-[#39393b]">
                      클라이언트명
                    </Label>
                    <Input
                      id="client-name"
                      value={selectedRecipient?.company_name || clientName}
                      disabled={!!selectedRecipient}
                      onChange={(event) => setClientName(event.target.value)}
                      placeholder="회사명 또는 고객명"
                      className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="client-contact" className="text-xs font-semibold text-[#39393b]">
                      담당자 / 연락처
                    </Label>
                    <Input
                      id="client-contact"
                      value={clientContact}
                      onChange={(event) => setClientContact(event.target.value)}
                      placeholder={selectedRecipient ? `${selectedRecipient.contact_person} / ${selectedRecipient.phone}` : '담당자 또는 연락처'}
                      className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="meeting-description" className="text-xs font-semibold text-[#39393b]">
              미팅 내용
            </Label>
            <Textarea
              id="meeting-description"
              value={descriptionText}
              onChange={(event) => setDescriptionText(event.target.value)}
              placeholder="안건, 준비물, 상담 목적 등을 기록하세요."
              className="min-h-24 rounded-lg border-[#cacacb] bg-white text-sm"
            />
          </div>

          <Button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={!!formError || createMutation.isPending}
            className="h-11 w-full rounded-full bg-[#111111] text-sm font-semibold text-white hover:bg-[#39393b]"
          >
            {createMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            예약 등록
          </Button>
          {formError && <p className="text-center text-xs font-medium text-[#707072]">{formError}</p>}
        </div>

        <aside className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '예정', value: upcomingCount, icon: CalendarDays },
              { label: '오늘', value: todayCount, icon: Clock3 },
              { label: '확정', value: confirmedCount, icon: CheckCircle2 },
            ].map((item) => {
              const MetricIcon = item.icon;
              return (
                <div key={item.label} className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
                  <MetricIcon className="h-4 w-4 text-[#707072]" />
                  <p className="mt-2 text-xl font-bold leading-none text-[#111111]">{item.value}</p>
                  <p className="mt-1 text-xs font-medium text-[#707072]">{item.label}</p>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-[#e5e5e5] bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-[#e5e5e5] px-3 py-3">
              <div>
                <h3 className="text-sm font-bold text-[#111111]">다가오는 예약</h3>
                <p className="text-xs text-[#707072]">공지사항과 분리된 미팅 예약 목록</p>
              </div>
              <UsersRound className="h-4 w-4 text-[#707072]" />
            </div>

            <div className="max-h-[540px] divide-y divide-[#e5e5e5] overflow-auto">
              {isReservationsLoading ? (
                <div className="flex items-center gap-2 p-4 text-sm text-[#707072]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  예약 목록을 불러오는 중
                </div>
              ) : reservations.length > 0 ? (
                reservations.map((reservation) => {
                  const editable = canManageAll || reservation.created_by === user?.id;
                  const status = reservation.status as MeetingReservationStatus;
                  const displayPeople =
                    reservation.audience_type === 'client'
                      ? reservation.client_name || '클라이언트 미정'
                      : reservation.participant_names.length > 0
                      ? reservation.participant_names.join(', ')
                      : '참석자 미정';

                  return (
                    <article key={reservation.id} className="space-y-3 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={cn('h-5 rounded-full px-2 text-[11px] font-semibold', MEETING_STATUS_CLASSES[status])}
                            >
                              {MEETING_STATUS_LABELS[status]}
                            </Badge>
                            <span className="text-xs font-semibold text-[#707072]">
                              {getMeetingTypeLabel(
                                reservation.audience_type as MeetingAudienceType,
                                reservation.employee_meeting_type as EmployeeMeetingType | null,
                                reservation.client_meeting_type as ClientMeetingType | null,
                              )}
                            </span>
                          </div>
                          <h4 className="mt-1 truncate text-sm font-bold leading-5 text-[#111111]">{reservation.title}</h4>
                        </div>

                        {editable && (
                          <Select
                            value={status}
                            onValueChange={(nextStatus) =>
                              statusMutation.mutate({
                                id: reservation.id,
                                status: nextStatus as MeetingReservationStatus,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-[92px] rounded-full border-[#cacacb] bg-white text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {MEETING_STATUS_LABELS[option]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      <div className="grid gap-1.5 text-xs leading-4 text-[#707072]">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {formatMeetingDate(reservation.meeting_date)}
                            {isTodayValue(reservation.meeting_date) ? ' / 오늘' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            {reservation.start_time}
                            {reservation.end_time ? ` - ${reservation.end_time}` : ''}
                          </span>
                        </div>
                        {reservation.location && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{reservation.location}</span>
                          </div>
                        )}
                        <div className="truncate font-medium text-[#39393b]">{displayPeople}</div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="p-4 text-sm text-[#707072]">예정된 미팅 예약이 없습니다.</div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default MeetingBookingWidget;
