import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  MapPin,
  Plus,
  Save,
  Search,
  UsersRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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

type MeetingReservationRow = {
  id: string;
  audience_type: MeetingAudienceType | string;
  employee_meeting_type: EmployeeMeetingType | string | null;
  client_meeting_type: ClientMeetingType | string | null;
  title: string;
  description: string | null;
  meeting_date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  status: MeetingReservationStatus | string;
  recipient_id: string | null;
  client_name: string | null;
  client_contact: string | null;
  participant_ids: string[];
  participant_names: string[];
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
};

type MeetingDraft = {
  audience_type: MeetingAudienceType;
  employee_meeting_type: EmployeeMeetingType;
  client_meeting_type: ClientMeetingType;
  title: string;
  meeting_date: string;
  start_time: string;
  duration_minutes: string;
  location: string;
  description: string;
  recipient_id: string;
  client_name: string;
  client_contact: string;
  participant_ids: string[];
  status: MeetingReservationStatus;
};

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
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

const TIME_OPTIONS = Array.from({ length: 21 }, (_, index) => {
  const totalMinutes = 9 * 60 + index * 30;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

const supabaseAny = supabase as any;

const todayString = () => format(new Date(), 'yyyy-MM-dd');

const createEmptyDraft = (audienceType: MeetingAudienceType): MeetingDraft => ({
  audience_type: audienceType,
  employee_meeting_type: 'one_on_one',
  client_meeting_type: 'showroom_visit',
  title: '',
  meeting_date: todayString(),
  start_time: '10:00',
  duration_minutes: '60',
  location: '',
  description: '',
  recipient_id: 'none',
  client_name: '',
  client_contact: '',
  participant_ids: [],
  status: 'scheduled',
});

const addMinutesToTime = (time: string, minutes: number) => {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date(2000, 0, 1, hour || 0, minute || 0);
  date.setMinutes(date.getMinutes() + minutes);
  return format(date, 'HH:mm');
};

const getDurationMinutes = (startTime: string, endTime: string | null) => {
  if (!startTime || !endTime) return '60';
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  const diff = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  return String(DURATION_OPTIONS.includes(diff) ? diff : 60);
};

const formatMeetingDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : format(date, 'M월 d일 (EEE)', { locale: ko });
};

const isTodayValue = (value: string) => value === todayString();

const getDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

const draftFromReservation = (reservation: MeetingReservationRow): MeetingDraft => ({
  audience_type: reservation.audience_type as MeetingAudienceType,
  employee_meeting_type: (reservation.employee_meeting_type || 'one_on_one') as EmployeeMeetingType,
  client_meeting_type: (reservation.client_meeting_type || 'showroom_visit') as ClientMeetingType,
  title: reservation.title,
  meeting_date: reservation.meeting_date,
  start_time: reservation.start_time,
  duration_minutes: getDurationMinutes(reservation.start_time, reservation.end_time),
  location: reservation.location || '',
  description: reservation.description || '',
  recipient_id: reservation.recipient_id || 'none',
  client_name: reservation.client_name || '',
  client_contact: reservation.client_contact || '',
  participant_ids: reservation.participant_ids || [],
  status: (reservation.status || 'scheduled') as MeetingReservationStatus,
});

const MeetingBookingWidget = ({
  className,
  defaultAudienceType = 'employee',
  maxItems = 12,
  showHeader = true,
  title: widgetTitle = '미팅 예약 관리',
  description: widgetDescription = '직원 미팅과 클라이언트 상담 일정을 한 위젯에서 분리해 예약합니다.',
}: MeetingBookingWidgetProps) => {
  const { user, profile, isAdmin, isModerator, isManager } = useAuth();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const canManageAll = isAdmin || isModerator || isManager;
  const focusedReservationId = searchParams.get('id');
  const safeFocusedReservationId = focusedReservationId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(focusedReservationId)
    ? focusedReservationId
    : null;
  const [draft, setDraft] = useState<MeetingDraft>(() => createEmptyDraft(defaultAudienceType));
  const [participantSearch, setParticipantSearch] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(todayString());
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [detailDraft, setDetailDraft] = useState<MeetingDraft | null>(null);
  const [detailParticipantSearch, setDetailParticipantSearch] = useState('');

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
    queryKey: ['meeting-reservations', safeFocusedReservationId],
    queryFn: async () => {
      let query = supabaseAny
        .from('meeting_reservations')
        .select('*')
        .order('meeting_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(100);

      query = safeFocusedReservationId
        ? query.or(`meeting_date.gte.${todayString()},id.eq.${safeFocusedReservationId}`)
        : query.gte('meeting_date', todayString());

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MeetingReservationRow[];
    },
    enabled: !!user,
  });

  const selectedRecipient = useMemo(
    () => recipients.find((recipient) => recipient.id === draft.recipient_id),
    [draft.recipient_id, recipients],
  );

  const selectedReservation = useMemo(
    () => reservations.find((reservation) => reservation.id === selectedReservationId) || null,
    [reservations, selectedReservationId],
  );

  useEffect(() => {
    if (!safeFocusedReservationId || reservations.length === 0 || selectedReservationId === safeFocusedReservationId) return;

    const focusedReservation = reservations.find((reservation) => reservation.id === safeFocusedReservationId);
    if (!focusedReservation) return;

    setSelectedCalendarDate(focusedReservation.meeting_date);
    setSelectedReservationId(focusedReservation.id);
    setDetailDraft(draftFromReservation(focusedReservation));
  }, [safeFocusedReservationId, reservations, selectedReservationId]);

  const detailRecipient = useMemo(
    () => (detailDraft ? recipients.find((recipient) => recipient.id === detailDraft.recipient_id) : undefined),
    [detailDraft, recipients],
  );

  const reservationsByDate = useMemo(() => {
    return reservations.reduce<Record<string, MeetingReservationRow[]>>((acc, reservation) => {
      acc[reservation.meeting_date] = [...(acc[reservation.meeting_date] || []), reservation];
      return acc;
    }, {});
  }, [reservations]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarMonth));
    const end = endOfWeek(endOfMonth(calendarMonth));
    return eachDayOfInterval({ start, end });
  }, [calendarMonth]);

  const listReservations = useMemo(() => {
    const filtered = selectedCalendarDate
      ? reservations.filter((reservation) => reservation.meeting_date === selectedCalendarDate)
      : reservations;
    return filtered.slice(0, maxItems);
  }, [maxItems, reservations, selectedCalendarDate]);

  const getParticipantNames = (ids: string[]) =>
    ids.map((id) => employees.find((employee) => employee.id === id)?.full_name).filter(Boolean) as string[];

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

  const visibleDetailEmployees = useMemo(() => {
    const keyword = detailParticipantSearch.trim().toLowerCase();
    if (!keyword) return employees.slice(0, 8);
    return employees
      .filter((employee) =>
        [employee.full_name, employee.department, employee.position]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(keyword)),
      )
      .slice(0, 8);
  }, [detailParticipantSearch, employees]);

  const validateDraft = (target: MeetingDraft, targetRecipient?: RecipientOption) => {
    if (!user || !profile) return '로그인 후 예약할 수 있습니다.';
    if (!target.title.trim()) return '미팅 제목을 입력해주세요.';
    if (!target.meeting_date) return '미팅 날짜를 선택해주세요.';
    if (!target.start_time) return '시작 시간을 선택해주세요.';
    if (
      target.audience_type === 'employee'
      && target.employee_meeting_type === 'one_on_one'
      && target.participant_ids.length === 0
    ) {
      return '1:1 미팅은 참석 직원을 1명 이상 선택해주세요.';
    }
    if (target.audience_type === 'client' && !targetRecipient && !target.client_name.trim()) {
      return '클라이언트명 또는 거래처를 입력해주세요.';
    }
    return '';
  };

  const formError = validateDraft(draft, selectedRecipient);
  const detailError = detailDraft ? validateDraft(detailDraft, detailRecipient) : '';

  const buildPayload = (target: MeetingDraft, targetRecipient?: RecipientOption) => {
    const isEmployeeMeeting = target.audience_type === 'employee';
    return {
      audience_type: target.audience_type,
      employee_meeting_type: isEmployeeMeeting ? target.employee_meeting_type : null,
      client_meeting_type: isEmployeeMeeting ? null : target.client_meeting_type,
      title: target.title.trim(),
      description: target.description.trim() || null,
      meeting_date: target.meeting_date,
      start_time: target.start_time,
      end_time: addMinutesToTime(target.start_time, Number(target.duration_minutes)),
      location: target.location.trim() || null,
      status: target.status,
      recipient_id: !isEmployeeMeeting && targetRecipient ? targetRecipient.id : null,
      client_name: !isEmployeeMeeting ? targetRecipient?.company_name || target.client_name.trim() || null : null,
      client_contact: !isEmployeeMeeting ? target.client_contact.trim() || targetRecipient?.contact_person || null : null,
      participant_ids: target.participant_ids,
      participant_names: getParticipantNames(target.participant_ids),
    };
  };

  const sendReservationNotifications = async (
    reservation: MeetingReservationRow,
    action: 'created' | 'updated' | 'status',
    includeCreator = false,
  ) => {
    if (!user) return;

    const targetIds = new Set<string>();
    const notifyAllEmployees =
      reservation.audience_type === 'employee'
      && reservation.employee_meeting_type === 'all_hands'
      && (!reservation.participant_ids || reservation.participant_ids.length === 0);

    if (notifyAllEmployees) {
      employees.forEach((employee) => targetIds.add(employee.id));
    } else {
      (reservation.participant_ids || []).forEach((id) => targetIds.add(id));
    }

    if (includeCreator) targetIds.add(reservation.created_by);
    targetIds.delete(user.id);

    const notifications = [...targetIds].map((userId) => ({
      user_id: userId,
      type: action === 'status' ? 'meeting_reservation_status' : 'meeting_reservation',
      title:
        action === 'created'
          ? '미팅 예약이 등록되었습니다'
          : action === 'updated'
          ? '미팅 예약이 변경되었습니다'
          : '미팅 예약 상태가 변경되었습니다',
      description: `${reservation.title} / ${formatMeetingDate(reservation.meeting_date)} ${reservation.start_time}`,
      data: { meetingReservationId: reservation.id, status: reservation.status },
    }));

    if (notifications.length === 0) return;

    const { error } = await supabase.from('notifications').insert(notifications);
    if (error) {
      toast.warning('예약은 저장됐지만 일부 알림 발송에 실패했습니다.');
    }
  };

  const resetForm = () => {
    setDraft((prev) => ({
      ...createEmptyDraft(prev.audience_type),
      meeting_date: prev.meeting_date,
      start_time: prev.start_time,
      duration_minutes: prev.duration_minutes,
    }));
    setParticipantSearch('');
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user || !profile) throw new Error('로그인 후 예약할 수 있습니다.');
      if (formError) throw new Error(formError);

      const payload = {
        ...buildPayload(draft, selectedRecipient),
        created_by: user.id,
        created_by_name: profile.full_name || user.email || '담당자',
      };

      const { data, error } = await supabaseAny.from('meeting_reservations').insert(payload).select('*').single();
      if (error) throw error;
      await sendReservationNotifications(data as MeetingReservationRow, 'created');
      return data as MeetingReservationRow;
    },
    onSuccess: (reservation) => {
      toast.success('미팅 예약이 등록되었습니다.');
      resetForm();
      setSelectedCalendarDate(reservation.meeting_date);
      setSelectedReservationId(reservation.id);
      setDetailDraft(draftFromReservation(reservation));
      queryClient.invalidateQueries({ queryKey: ['meeting-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-meeting-booking-card'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-meeting-reservations'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || '미팅 예약 등록에 실패했습니다.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReservation || !detailDraft) throw new Error('수정할 예약을 선택해주세요.');
      if (detailError) throw new Error(detailError);

      const { data, error } = await supabaseAny
        .from('meeting_reservations')
        .update(buildPayload(detailDraft, detailRecipient))
        .eq('id', selectedReservation.id)
        .select('*')
        .single();
      if (error) throw error;
      await sendReservationNotifications(data as MeetingReservationRow, 'updated', true);
      return data as MeetingReservationRow;
    },
    onSuccess: (reservation) => {
      toast.success('미팅 예약이 수정되었습니다.');
      setSelectedCalendarDate(reservation.meeting_date);
      setSelectedReservationId(reservation.id);
      setDetailDraft(draftFromReservation(reservation));
      queryClient.invalidateQueries({ queryKey: ['meeting-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-meeting-booking-card'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-meeting-reservations'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || '미팅 예약 수정에 실패했습니다.');
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ reservation, status }: { reservation: MeetingReservationRow; status: MeetingReservationStatus }) => {
      const { data, error } = await supabaseAny
        .from('meeting_reservations')
        .update({ status })
        .eq('id', reservation.id)
        .select('*')
        .single();
      if (error) throw error;
      await sendReservationNotifications(data as MeetingReservationRow, 'status', true);
      return data as MeetingReservationRow;
    },
    onSuccess: (reservation) => {
      if (selectedReservationId === reservation.id) {
        setDetailDraft(draftFromReservation(reservation));
      }
      queryClient.invalidateQueries({ queryKey: ['meeting-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-meeting-booking-card'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-meeting-reservations'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || '상태 변경에 실패했습니다.');
    },
  });

  const setDraftField = <K extends keyof MeetingDraft>(key: K, value: MeetingDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const setDetailDraftField = <K extends keyof MeetingDraft>(key: K, value: MeetingDraft[K]) => {
    setDetailDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const toggleDraftParticipant = (employeeId: string) => {
    setDraft((prev) => ({
      ...prev,
      participant_ids: prev.participant_ids.includes(employeeId)
        ? prev.participant_ids.filter((id) => id !== employeeId)
        : [...prev.participant_ids, employeeId],
    }));
  };

  const toggleDetailParticipant = (employeeId: string) => {
    setDetailDraft((prev) =>
      prev
        ? {
            ...prev,
            participant_ids: prev.participant_ids.includes(employeeId)
              ? prev.participant_ids.filter((id) => id !== employeeId)
              : [...prev.participant_ids, employeeId],
          }
        : prev,
    );
  };

  const handleAudienceChange = (value: MeetingAudienceType) => {
    setDraft((prev) => ({
      ...prev,
      audience_type: value,
      recipient_id: 'none',
      client_name: '',
      client_contact: '',
      participant_ids: [],
    }));
    setParticipantSearch('');
  };

  const openDetail = (reservation: MeetingReservationRow) => {
    setSelectedReservationId(reservation.id);
    setDetailDraft(draftFromReservation(reservation));
    setDetailParticipantSearch('');
  };

  const closeDetail = () => {
    setSelectedReservationId(null);
    setDetailDraft(null);
    setDetailParticipantSearch('');
  };

  const renderParticipantPicker = ({
    label,
    selectedIds,
    searchValue,
    onSearchChange,
    onToggle,
    visibleOptions,
    disabled = false,
  }: {
    label: string;
    selectedIds: string[];
    searchValue: string;
    onSearchChange: (value: string) => void;
    onToggle: (employeeId: string) => void;
    visibleOptions: EmployeeOption[];
    disabled?: boolean;
  }) => (
    <div className="space-y-2 rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-semibold text-[#39393b]">{label}</Label>
        <span className="text-xs text-[#707072]">{selectedIds.length}명 선택</span>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9e9ea0]" />
        <Input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          disabled={disabled}
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
        ) : visibleOptions.length > 0 ? (
          visibleOptions.map((employee) => {
            const selected = selectedIds.includes(employee.id);
            return (
              <button
                key={employee.id}
                type="button"
                disabled={disabled}
                onClick={() => onToggle(employee.id)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
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
  );

  const upcomingCount = reservations.filter((reservation) => reservation.status !== 'canceled').length;
  const todayCount = reservations.filter(
    (reservation) => reservation.status !== 'canceled' && isTodayValue(reservation.meeting_date),
  ).length;
  const confirmedCount = reservations.filter((reservation) => reservation.status === 'confirmed').length;
  const canEditSelected = selectedReservation ? canManageAll || selectedReservation.created_by === user?.id : false;

  return (
    <section
      className={cn(
        'w-full max-w-[960px] rounded-xl border border-[#e5e5e5] bg-white text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.04)]',
        className,
      )}
    >
      {showHeader && (
        <header className="border-b border-[#e5e5e5] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-sans text-[11px] font-extrabold uppercase leading-none tracking-normal text-[#707072]">
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

      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_370px]">
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
                    draft.audience_type === option.value
                      ? 'border-[#111111] bg-[#111111] text-white'
                      : 'border-[#cacacb] bg-white text-[#111111] hover:border-[#111111]',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
                      draft.audience_type === option.value ? 'border-white/20 bg-white/10' : 'border-[#e5e5e5] bg-[#f5f5f5]',
                    )}
                  >
                    <AudienceIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-5">{option.label}</span>
                    <span
                      className={cn(
                        'mt-0.5 block text-xs leading-4',
                        draft.audience_type === option.value ? 'text-white/70' : 'text-[#707072]',
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
            <div className={cn('grid gap-2', draft.audience_type === 'client' ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
              {(draft.audience_type === 'employee' ? EMPLOYEE_MEETING_OPTIONS : CLIENT_MEETING_OPTIONS).map((option) => {
                const active =
                  draft.audience_type === 'employee'
                    ? option.value === draft.employee_meeting_type
                    : option.value === draft.client_meeting_type;
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      if (draft.audience_type === 'employee') {
                        setDraftField('employee_meeting_type', option.value as EmployeeMeetingType);
                      } else {
                        setDraftField('client_meeting_type', option.value as ClientMeetingType);
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
                value={draft.title}
                onChange={(event) => setDraftField('title', event.target.value)}
                placeholder={draft.audience_type === 'employee' ? '예: 제작팀 주간 회의' : '예: 쇼룸 방문 제작 상담'}
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
                value={draft.meeting_date}
                min={todayString()}
                onChange={(event) => setDraftField('meeting_date', event.target.value)}
                className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
              />
            </div>

            <div className="grid grid-cols-[1fr_92px] gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#39393b]">시작</Label>
                <Select value={draft.start_time} onValueChange={(value) => setDraftField('start_time', value)}>
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
                <Select value={draft.duration_minutes} onValueChange={(value) => setDraftField('duration_minutes', value)}>
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
                value={draft.location}
                onChange={(event) => setDraftField('location', event.target.value)}
                placeholder={draft.audience_type === 'employee' ? '예: 2층 회의실' : '예: ACBANK 쇼룸, 클라이언트 현장'}
                className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
              />
            </div>
          </div>

          {draft.audience_type === 'client' && (
            <div className="space-y-3 rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#39393b]">거래처 선택</Label>
                <Select value={draft.recipient_id} onValueChange={(value) => setDraftField('recipient_id', value)}>
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
                      value={selectedRecipient?.company_name || draft.client_name}
                      disabled={!!selectedRecipient}
                      onChange={(event) => setDraftField('client_name', event.target.value)}
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
                      value={draft.client_contact}
                      onChange={(event) => setDraftField('client_contact', event.target.value)}
                      placeholder={selectedRecipient ? `${selectedRecipient.contact_person} / ${selectedRecipient.phone}` : '담당자 또는 연락처'}
                      className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {renderParticipantPicker({
            label: draft.audience_type === 'employee' ? '참석 직원' : '내부 담당 직원',
            selectedIds: draft.participant_ids,
            searchValue: participantSearch,
            onSearchChange: setParticipantSearch,
            onToggle: toggleDraftParticipant,
            visibleOptions: visibleEmployees,
          })}

          <div className="space-y-1.5">
            <Label htmlFor="meeting-description" className="text-xs font-semibold text-[#39393b]">
              미팅 내용
            </Label>
            <Textarea
              id="meeting-description"
              value={draft.description}
              onChange={(event) => setDraftField('description', event.target.value)}
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

          <div className="rounded-lg border border-[#e5e5e5] bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full border-[#cacacb]"
                onClick={() => setCalendarMonth((current) => subMonths(current, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center">
                <h3 className="text-sm font-bold text-[#111111]">{format(calendarMonth, 'yyyy년 M월', { locale: ko })}</h3>
                <button
                  type="button"
                  onClick={() => setSelectedCalendarDate(null)}
                  className="mt-0.5 text-xs font-medium text-[#707072] underline-offset-4 hover:underline"
                >
                  전체 예약 보기
                </button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full border-[#cacacb]"
                onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[#707072]">
              {WEEKDAY_LABELS.map((weekday) => (
                <div key={weekday}>{weekday}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const dateKey = getDateKey(day);
                const dayReservations = reservationsByDate[dateKey] || [];
                const selected = selectedCalendarDate === dateKey;
                const isMuted = format(day, 'M') !== format(calendarMonth, 'M');
                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => setSelectedCalendarDate(dateKey)}
                    className={cn(
                      'relative flex aspect-square min-h-10 flex-col items-center justify-center rounded-lg border text-xs transition-colors',
                      selected
                        ? 'border-[#111111] bg-[#111111] text-white'
                        : 'border-[#e5e5e5] bg-white text-[#111111] hover:border-[#cacacb]',
                      isMuted && !selected && 'text-[#9e9ea0]',
                    )}
                  >
                    <span className="font-semibold">{format(day, 'd')}</span>
                    {dayReservations.length > 0 && (
                      <span
                        className={cn(
                          'mt-0.5 h-1.5 w-1.5 rounded-full',
                          selected ? 'bg-white' : 'bg-[#111111]',
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedReservation && detailDraft && (
            <div className="rounded-lg border border-[#111111] bg-white">
              <div className="flex items-start justify-between gap-3 border-b border-[#e5e5e5] px-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-[#707072]" />
                    <h3 className="truncate text-sm font-bold text-[#111111]">예약 상세</h3>
                  </div>
                  <p className="mt-1 text-xs text-[#707072]">
                    {canEditSelected ? '수정 후 저장하면 참석자에게 알림이 전송됩니다.' : '읽기 전용 예약입니다.'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={closeDetail}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3 p-3">
                <Input
                  value={detailDraft.title}
                  disabled={!canEditSelected}
                  onChange={(event) => setDetailDraftField('title', event.target.value)}
                  className="h-10 rounded-lg border-[#cacacb] bg-white text-sm font-semibold"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={detailDraft.meeting_date}
                    disabled={!canEditSelected}
                    onChange={(event) => setDetailDraftField('meeting_date', event.target.value)}
                    className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
                  />
                  <Select
                    value={detailDraft.status}
                    disabled={!canEditSelected}
                    onValueChange={(value) => setDetailDraftField('status', value as MeetingReservationStatus)}
                  >
                    <SelectTrigger className="h-10 rounded-lg border-[#cacacb] bg-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {MEETING_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-[1fr_92px] gap-2">
                  <Select
                    value={detailDraft.start_time}
                    disabled={!canEditSelected}
                    onValueChange={(value) => setDetailDraftField('start_time', value)}
                  >
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
                  <Select
                    value={detailDraft.duration_minutes}
                    disabled={!canEditSelected}
                    onValueChange={(value) => setDetailDraftField('duration_minutes', value)}
                  >
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
                <Input
                  value={detailDraft.location}
                  disabled={!canEditSelected}
                  onChange={(event) => setDetailDraftField('location', event.target.value)}
                  placeholder="장소"
                  className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
                />

                {detailDraft.audience_type === 'client' && (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    <Input
                      value={detailRecipient?.company_name || detailDraft.client_name}
                      disabled={!canEditSelected || !!detailRecipient}
                      onChange={(event) => setDetailDraftField('client_name', event.target.value)}
                      placeholder="클라이언트명"
                      className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
                    />
                    <Input
                      value={detailDraft.client_contact}
                      disabled={!canEditSelected}
                      onChange={(event) => setDetailDraftField('client_contact', event.target.value)}
                      placeholder="담당자 / 연락처"
                      className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
                    />
                  </div>
                )}

                {renderParticipantPicker({
                  label: detailDraft.audience_type === 'employee' ? '참석 직원' : '내부 담당 직원',
                  selectedIds: detailDraft.participant_ids,
                  searchValue: detailParticipantSearch,
                  onSearchChange: setDetailParticipantSearch,
                  onToggle: toggleDetailParticipant,
                  visibleOptions: visibleDetailEmployees,
                  disabled: !canEditSelected,
                })}

                <Textarea
                  value={detailDraft.description}
                  disabled={!canEditSelected}
                  onChange={(event) => setDetailDraftField('description', event.target.value)}
                  placeholder="미팅 내용"
                  className="min-h-20 rounded-lg border-[#cacacb] bg-white text-sm"
                />

                {canEditSelected && (
                  <Button
                    type="button"
                    onClick={() => updateMutation.mutate()}
                    disabled={!!detailError || updateMutation.isPending}
                    className="h-10 w-full rounded-full bg-[#111111] text-sm font-semibold text-white hover:bg-[#39393b]"
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    변경 저장
                  </Button>
                )}
                {detailError && <p className="text-center text-xs font-medium text-[#707072]">{detailError}</p>}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-[#e5e5e5] bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-[#e5e5e5] px-3 py-3">
              <div>
                <h3 className="text-sm font-bold text-[#111111]">
                  {selectedCalendarDate ? formatMeetingDate(selectedCalendarDate) : '다가오는 예약'}
                </h3>
                <p className="text-xs text-[#707072]">목록에서 상세 편집 패널을 열 수 있습니다.</p>
              </div>
              <UsersRound className="h-4 w-4 text-[#707072]" />
            </div>

            <div className="max-h-[540px] divide-y divide-[#e5e5e5] overflow-auto">
              {isReservationsLoading ? (
                <div className="flex items-center gap-2 p-4 text-sm text-[#707072]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  예약 목록을 불러오는 중
                </div>
              ) : listReservations.length > 0 ? (
                listReservations.map((reservation) => {
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
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openDetail(reservation)}>
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
                        </button>

                        {editable && (
                          <Select
                            value={status}
                            onValueChange={(nextStatus) =>
                              statusMutation.mutate({
                                reservation,
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

                      <button type="button" className="grid w-full gap-1.5 text-left text-xs leading-4 text-[#707072]" onClick={() => openDetail(reservation)}>
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
                      </button>
                    </article>
                  );
                })
              ) : (
                <div className="p-4 text-sm text-[#707072]">선택한 범위에 예정된 미팅 예약이 없습니다.</div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default MeetingBookingWidget;
