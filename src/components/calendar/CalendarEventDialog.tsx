import { useEffect, useMemo, useState } from 'react';
import { addDays, differenceInMinutes, format } from 'date-fns';
import { BellRing, CalendarCheck2, Check, Loader2, LockKeyhole, Repeat2, Search, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import CalendarEventDeleteActions from '@/components/calendar/CalendarEventDeleteActions';
import { cn } from '@/lib/utils';
import {
  addMinutesToClockTime,
  toSeoulDateTime,
  useCalendarDirectory,
  useCalendarResources,
  useCalendarTeams,
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
} from '@/hooks/useInternalCalendar';
import {
  CALENDAR_VISIBILITY_LABELS,
  type CalendarDirectoryUser,
  type CalendarEventStatus,
  type CalendarEventVisibility,
  type CalendarIconType,
  type CalendarRecurrenceFrequency,
  type CalendarRecurrenceRule,
  type InternalCalendarEvent,
} from '@/types/internalCalendar';

type CalendarDialogMode = 'personal' | 'team' | 'employee' | 'client' | 'room' | 'manual' | 'event' | 'holiday';

interface CalendarEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: InternalCalendarEvent | null;
  events?: InternalCalendarEvent[];
  defaultDate?: string;
  defaultMode?: CalendarDialogMode;
  onSaved?: (eventId: string) => void;
}

type Draft = {
  mode: CalendarDialogMode;
  title: string;
  date: string;
  startTime: string;
  durationMinutes: string;
  description: string;
  location: string;
  visibility: CalendarEventVisibility;
  status: CalendarEventStatus;
  allDay: boolean;
  teamDepartment: string;
  selectedUserIds: string[];
  selectedResourceIds: string[];
  clientName: string;
  clientContact: string;
  recurrenceFrequency: CalendarRecurrenceFrequency;
  recurrenceInterval: string;
  recurrenceUntil: string;
  recurrenceWeekdays: number[];
  reminderMinutes: number[];
};

const DURATION_OPTIONS = [30, 60, 90, 120, 180];
const REMINDER_OPTIONS = [
  { value: 10, label: '10분 전' },
  { value: 30, label: '30분 전' },
  { value: 60, label: '1시간 전' },
  { value: 1440, label: '1일 전' },
];
const RECURRENCE_OPTIONS: Array<{ value: CalendarRecurrenceFrequency; label: string }> = [
  { value: 'none', label: '반복 안함' },
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '매주' },
  { value: 'monthly', label: '매월' },
  { value: 'yearly', label: '매년' },
];
const WEEKDAY_OPTIONS = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 0, label: '일' },
];
const TIME_OPTIONS = Array.from({ length: 25 }, (_, index) => {
  const totalMinutes = 8 * 60 + index * 30;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

const todayString = () => format(new Date(), 'yyyy-MM-dd');

const MODE_OPTIONS: Array<{ value: CalendarDialogMode; label: string }> = [
  { value: 'personal', label: '개인 일정' },
  { value: 'team', label: '팀 일정' },
  { value: 'employee', label: '직원 미팅' },
  { value: 'client', label: '클라이언트' },
  { value: 'room', label: '회의실 예약' },
  { value: 'event', label: '이벤트' },
  { value: 'holiday', label: '휴무일' },
];

const MODE_DEFAULTS: Record<CalendarDialogMode, {
  titlePlaceholder: string;
  visibility: CalendarEventVisibility;
  status: CalendarEventStatus;
  allDay: boolean;
  accent: string | null;
  iconType: CalendarIconType | null;
  sourceSubtype: string;
}> = {
  personal: {
    titlePlaceholder: '예: 집중 작업, 개인 일정, 할 일 정리',
    visibility: 'private',
    status: 'scheduled',
    allDay: false,
    accent: '#111111',
    iconType: 'calendar',
    sourceSubtype: 'personal',
  },
  team: {
    titlePlaceholder: '예: 팀 주간회의, 부서 공유 일정',
    visibility: 'details',
    status: 'scheduled',
    allDay: false,
    accent: '#2563eb',
    iconType: 'meeting',
    sourceSubtype: 'team',
  },
  employee: {
    titlePlaceholder: '예: 1:1 미팅, 팀 회의',
    visibility: 'title_only',
    status: 'scheduled',
    allDay: false,
    accent: null,
    iconType: null,
    sourceSubtype: 'default',
  },
  client: {
    titlePlaceholder: '예: 제작 상담, 납기 협의',
    visibility: 'title_only',
    status: 'scheduled',
    allDay: false,
    accent: null,
    iconType: null,
    sourceSubtype: 'default',
  },
  room: {
    titlePlaceholder: '예: 1층 회의실 예약',
    visibility: 'title_only',
    status: 'scheduled',
    allDay: false,
    accent: null,
    iconType: null,
    sourceSubtype: 'default',
  },
  manual: {
    titlePlaceholder: '예: 내부 일정, 작업 집중 시간',
    visibility: 'title_only',
    status: 'scheduled',
    allDay: false,
    accent: '#111111',
    iconType: 'calendar',
    sourceSubtype: 'default',
  },
  event: {
    titlePlaceholder: '예: 사내 행사, 방문 일정, 전시 이벤트',
    visibility: 'details',
    status: 'confirmed',
    allDay: true,
    accent: '#10b981',
    iconType: 'event',
    sourceSubtype: 'event',
  },
  holiday: {
    titlePlaceholder: '예: 회사 휴무일, 대체휴무일',
    visibility: 'details',
    status: 'confirmed',
    allDay: true,
    accent: '#ef4444',
    iconType: 'holiday',
    sourceSubtype: 'holiday',
  },
};

function getModeDefaults(mode: CalendarDialogMode) {
  return MODE_DEFAULTS[mode] || MODE_DEFAULTS.manual;
}

function getEventMode(event: InternalCalendarEvent): CalendarDialogMode {
  const calendarKind = event.metadata?.calendar_kind;
  if (calendarKind === 'personal' || event.source_subtype === 'personal') return 'personal';
  if (calendarKind === 'team' || event.source_subtype === 'team') return 'team';
  if (calendarKind === 'holiday' || event.icon_type === 'holiday') return 'holiday';
  if (calendarKind === 'event' || event.icon_type === 'event') return 'event';
  return (calendarKind as CalendarDialogMode | undefined)
    || (event.client_name ? 'client' : event.resource_ids.length > 0 ? 'room' : 'employee');
}

function getRecurrenceInitial(rule: CalendarRecurrenceRule | null, startDate: Date) {
  return {
    recurrenceFrequency: (rule?.frequency || 'none') as CalendarRecurrenceFrequency,
    recurrenceInterval: String(rule?.interval || 1),
    recurrenceUntil: rule?.until || '',
    recurrenceWeekdays: rule?.weekdays && rule.weekdays.length > 0 ? rule.weekdays : [startDate.getDay()],
  };
}

function getInitialDraft({
  event,
  defaultDate,
  defaultMode,
}: {
  event?: InternalCalendarEvent | null;
  defaultDate?: string;
  defaultMode: CalendarDialogMode;
}): Draft {
  if (!event) {
    const defaults = getModeDefaults(defaultMode);
    return {
      mode: defaultMode,
      title: '',
      date: defaultDate || todayString(),
      startTime: defaults.allDay ? '00:00' : '10:00',
      durationMinutes: '60',
      description: '',
      location: '',
      visibility: defaults.visibility,
      status: defaults.status,
      allDay: defaults.allDay,
      teamDepartment: '',
      selectedUserIds: [],
      selectedResourceIds: [],
      clientName: '',
      clientContact: '',
      recurrenceFrequency: 'none',
      recurrenceInterval: '1',
      recurrenceUntil: '',
      recurrenceWeekdays: [new Date(`${defaultDate || todayString()}T00:00:00`).getDay()],
      reminderMinutes: [],
    };
  }

  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);
  const duration = Math.max(30, differenceInMinutes(end, start));
  const eventMode = getEventMode(event);
  const recurrenceInitial = getRecurrenceInitial(event.recurrence_rule, start);

  return {
    mode: eventMode,
    title: event.title,
    date: format(start, 'yyyy-MM-dd'),
    startTime: format(start, 'HH:mm'),
    durationMinutes: String(DURATION_OPTIONS.includes(duration) ? duration : 60),
    description: event.description || '',
    location: event.location || '',
    visibility: event.visibility,
    status: event.status,
    allDay: event.all_day || eventMode === 'holiday',
    teamDepartment: event.team_department || '',
    selectedUserIds: event.participant_ids.filter((id) => id !== event.created_by),
    selectedResourceIds: event.resource_ids,
    clientName: event.client_name || '',
    clientContact: event.client_contact || '',
    ...recurrenceInitial,
    reminderMinutes: event.reminder_minutes || [],
  };
}

function eventOverlapsResource(
  event: InternalCalendarEvent,
  resourceId: string,
  startIso: string,
  endIso: string,
  currentEventId?: string,
) {
  if (event.id === currentEventId || event.status === 'canceled' || !event.resource_ids.includes(resourceId)) return false;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return new Date(event.starts_at).getTime() < end && new Date(event.ends_at).getTime() > start;
}

const CalendarEventDialog = ({
  open,
  onOpenChange,
  event,
  events = [],
  defaultDate,
  defaultMode = 'employee',
  onSaved,
}: CalendarEventDialogProps) => {
  const [draft, setDraft] = useState<Draft>(() => getInitialDraft({ event, defaultDate, defaultMode }));
  const [employeeSearch, setEmployeeSearch] = useState('');
  const { data: employees = [], isLoading: isEmployeesLoading } = useCalendarDirectory();
  const { data: resources = [], isLoading: isResourcesLoading } = useCalendarResources();
  const { data: teams = [] } = useCalendarTeams();
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const saving = createEvent.isPending || updateEvent.isPending;

  useEffect(() => {
    if (!open) return;
    setDraft(getInitialDraft({ event, defaultDate, defaultMode }));
    setEmployeeSearch('');
  }, [defaultDate, defaultMode, event, open]);

  const selectedTeam = teams.find((team) => team.id === draft.teamDepartment);
  const selectedTeamMemberIds = selectedTeam?.members.map((member) => member.user_id) || [];

  const visibleEmployees = useMemo(() => {
    const keyword = employeeSearch.trim().toLowerCase();
    const candidates = keyword
      ? employees.filter((employee) =>
          [employee.full_name, employee.department, employee.position]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(keyword)),
        )
      : employees;
    return candidates.slice(0, 12);
  }, [employeeSearch, employees]);

  const selectedResources = resources.filter((resource) => draft.selectedResourceIds.includes(resource.id));
  const modeDefaults = getModeDefaults(draft.mode);
  const isAllDay = draft.mode === 'holiday' || draft.allDay;
  const startIso = toSeoulDateTime(draft.date, isAllDay ? '00:00' : draft.startTime);
  const endIso = isAllDay
    ? toSeoulDateTime(format(addDays(new Date(`${draft.date}T00:00:00`), 1), 'yyyy-MM-dd'), '00:00')
    : toSeoulDateTime(draft.date, addMinutesToClockTime(draft.startTime, Number(draft.durationMinutes)));

  const conflictingResourceNames = selectedResources
    .filter((resource) => events.some((item) => eventOverlapsResource(item, resource.id, startIso, endIso, event?.id)))
    .map((resource) => resource.name);
  const recurrenceRule: CalendarRecurrenceRule | null = draft.recurrenceFrequency === 'none' ? null : {
    frequency: draft.recurrenceFrequency,
    interval: Math.max(1, Number(draft.recurrenceInterval || 1)),
    until: draft.recurrenceUntil || null,
    ...(draft.recurrenceFrequency === 'weekly' ? { weekdays: draft.recurrenceWeekdays } : {}),
  };

  const setDraftField = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const toggleUser = (userId: string) => {
    setDraft((current) => ({
      ...current,
      selectedUserIds: current.selectedUserIds.includes(userId)
        ? current.selectedUserIds.filter((id) => id !== userId)
        : [...current.selectedUserIds, userId],
    }));
  };

  const toggleResource = (resourceId: string) => {
    setDraft((current) => ({
      ...current,
      selectedResourceIds: current.selectedResourceIds.includes(resourceId)
        ? current.selectedResourceIds.filter((id) => id !== resourceId)
        : [...current.selectedResourceIds, resourceId],
    }));
  };

  const validationError = useMemo(() => {
    if (!draft.title.trim()) return '일정 제목을 입력해주세요.';
    if (!draft.date || (!isAllDay && !draft.startTime)) return '일정 날짜와 시간을 선택해주세요.';
    if (draft.mode === 'team' && !draft.teamDepartment) {
      return '팀 일정을 등록하려면 팀 캘린더를 선택해주세요.';
    }
    if (draft.mode === 'employee' && draft.selectedUserIds.length === 0 && !draft.teamDepartment) {
      return '참석 직원 또는 팀을 선택해주세요.';
    }
    if (draft.mode === 'client' && draft.selectedUserIds.length === 0) {
      return '클라이언트 미팅 담당자를 선택해주세요.';
    }
    if (draft.mode === 'room' && draft.selectedResourceIds.length === 0) {
      return '예약할 회의실을 선택해주세요.';
    }
    if (conflictingResourceNames.length > 0) {
      return `${conflictingResourceNames.join(', ')}은 선택한 시간에 이미 예약되어 있습니다.`;
    }
    return '';
  }, [conflictingResourceNames, draft.date, draft.mode, draft.selectedResourceIds.length, draft.selectedUserIds.length, draft.startTime, draft.teamDepartment, draft.title, isAllDay]);

  const toggleWeekday = (weekday: number) => {
    setDraft((current) => {
      const next = current.recurrenceWeekdays.includes(weekday)
        ? current.recurrenceWeekdays.filter((day) => day !== weekday)
        : [...current.recurrenceWeekdays, weekday];
      return { ...current, recurrenceWeekdays: next.length > 0 ? next : [new Date(`${current.date}T00:00:00`).getDay()] };
    });
  };

  const toggleReminder = (minutes: number) => {
    setDraft((current) => ({
      ...current,
      reminderMinutes: current.reminderMinutes.includes(minutes)
        ? current.reminderMinutes.filter((item) => item !== minutes)
        : [...current.reminderMinutes, minutes].sort((a, b) => a - b),
    }));
  };

  const handleSubmit = async () => {
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const resourceLocation = selectedResources.map((resource) => resource.name).join(', ');
    const calendarKind = draft.mode;
    const baseMetadata = { ...(event?.metadata || {}) };
    delete baseMetadata.employee_meeting_type;
    const payload = {
      ...(event ? { id: event.id } : {}),
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      starts_at: startIso,
      ends_at: endIso,
      all_day: isAllDay,
      location: resourceLocation || draft.location.trim() || null,
      visibility: draft.visibility,
      status: draft.status,
      source_type: 'manual' as const,
      source_subtype: modeDefaults.sourceSubtype,
      accent: draft.mode === 'team' ? selectedTeam?.color || modeDefaults.accent : modeDefaults.accent,
      icon_type: modeDefaults.iconType,
      team_department: draft.mode === 'personal' ? null : draft.teamDepartment || null,
      client_name: draft.mode === 'client' ? draft.clientName.trim() || null : null,
      client_contact: draft.mode === 'client' ? draft.clientContact.trim() || null : null,
      participant_ids: draft.mode === 'team'
        ? selectedTeamMemberIds
        : draft.mode === 'client' || draft.mode === 'holiday' || draft.mode === 'personal'
          ? []
          : draft.selectedUserIds,
      assignee_ids: draft.mode === 'client' ? draft.selectedUserIds : [],
      resource_ids: draft.mode === 'holiday' || draft.mode === 'personal' ? [] : draft.selectedResourceIds,
      recurrence_rule: recurrenceRule,
      reminder_minutes: draft.reminderMinutes,
      metadata: {
        ...baseMetadata,
        calendar_kind: calendarKind,
        calendar_label: MODE_OPTIONS.find((option) => option.value === calendarKind)?.label || '일정',
        ...(draft.mode === 'team' && selectedTeam ? { team_calendar_id: selectedTeam.id, team_calendar_name: selectedTeam.name } : {}),
        ...(draft.mode === 'event' || draft.mode === 'holiday' ? { employee_meeting_type: 'all_hands' } : {}),
      },
    };

    try {
      const savedId = event
        ? await updateEvent.mutateAsync({ ...payload, id: event.id })
        : await createEvent.mutateAsync(payload);
      toast.success(event ? '일정이 수정되었습니다.' : '일정이 등록되었습니다.');
      onSaved?.(savedId);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || '일정 저장에 실패했습니다.');
    }
  };

  const renderEmployeePicker = (label: string) => (
    <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-semibold text-[#39393b]">{label}</Label>
        <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">
          {draft.selectedUserIds.length}명
        </Badge>
      </div>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9e9ea0]" />
        <Input
          value={employeeSearch}
          onChange={(event) => setEmployeeSearch(event.target.value)}
          placeholder="이름, 부서, 직책 검색"
          className="h-9 rounded-full border-[#cacacb] bg-white pl-8 text-sm"
        />
      </div>
      <div className="mt-2 grid max-h-44 gap-1.5 overflow-auto pr-1 sm:grid-cols-2">
        {isEmployeesLoading ? (
          <div className="col-span-full flex items-center gap-2 rounded-lg border border-[#e5e5e5] bg-white p-3 text-sm text-[#707072]">
            <Loader2 className="h-4 w-4 animate-spin" />
            직원 목록을 불러오는 중
          </div>
        ) : visibleEmployees.length > 0 ? (
          visibleEmployees.map((employee: CalendarDirectoryUser) => {
            const selected = draft.selectedUserIds.includes(employee.id);
            return (
              <button
                key={employee.id}
                type="button"
                onClick={() => toggleUser(employee.id)}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
                  selected ? 'border-[#111111] bg-[#111111] text-white' : 'border-[#e5e5e5] bg-white text-[#111111] hover:border-[#cacacb]',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{employee.full_name}</span>
                  <span className={cn('block truncate text-xs', selected ? 'text-white/70' : 'text-[#707072]')}>
                    {[employee.department, employee.position].filter(Boolean).join(' / ') || '부서 미설정'}
                  </span>
                </span>
                {selected && <Check className="h-4 w-4 shrink-0" />}
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-[#e5e5e5] bg-white p-0 shadow-xl">
        <DialogHeader className="border-b border-[#e5e5e5] px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-[#111111]">
            <CalendarCheck2 className="h-5 w-5" />
            {event ? '일정 수정' : '새 일정 예약'}
          </DialogTitle>
          <DialogDescription className="text-sm text-[#707072]">
            참석자와 회의실을 함께 선택하면 각 캘린더에 자동으로 반영됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-4">
              {MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    const nextMode = option.value;
                    const defaults = getModeDefaults(nextMode);
                    setDraft((current) => ({
                      ...current,
                      mode: nextMode,
                      visibility: defaults.visibility,
                      status: defaults.status,
                      allDay: defaults.allDay,
                      startTime: defaults.allDay ? '00:00' : current.startTime,
                      teamDepartment: nextMode === 'personal' ? '' : current.teamDepartment,
                      selectedResourceIds: nextMode === 'holiday' || nextMode === 'personal' ? [] : current.selectedResourceIds,
                      selectedUserIds: nextMode === 'holiday' || nextMode === 'personal' ? [] : current.selectedUserIds,
                    }));
                  }}
                  className={cn(
                    'h-10 rounded-full border px-3 text-sm font-semibold transition-colors',
                    draft.mode === option.value
                      ? 'border-[#111111] bg-[#111111] text-white'
                      : 'border-[#cacacb] bg-white text-[#39393b] hover:border-[#111111]',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold text-[#39393b]">제목</Label>
                <Input
                  value={draft.title}
                  onChange={(event) => setDraftField('title', event.target.value)}
                  placeholder={modeDefaults.titlePlaceholder}
                  className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#39393b]">날짜</Label>
                <Input
                  type="date"
                  value={draft.date}
                  onChange={(event) => setDraftField('date', event.target.value)}
                  className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#39393b]">종일</Label>
                <div className="flex h-10 items-center justify-between rounded-lg border border-[#cacacb] bg-white px-3">
                  <span className="text-sm text-[#39393b]">{isAllDay ? '종일 일정' : '시간 지정'}</span>
                  <Switch
                    checked={isAllDay}
                    disabled={draft.mode === 'holiday'}
                    onCheckedChange={(checked) => setDraftField('allDay', checked)}
                  />
                </div>
              </div>
              {!isAllDay && (
                <div className="grid grid-cols-[1fr_96px] gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#39393b]">시작</Label>
                    <Select value={draft.startTime} onValueChange={(value) => setDraftField('startTime', value)}>
                      <SelectTrigger className="h-10 rounded-lg border-[#cacacb] bg-white text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((time) => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#39393b]">길이</Label>
                    <Select value={draft.durationMinutes} onValueChange={(value) => setDraftField('durationMinutes', value)}>
                      <SelectTrigger className="h-10 rounded-lg border-[#cacacb] bg-white text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DURATION_OPTIONS.map((duration) => (
                          <SelectItem key={duration} value={String(duration)}>{duration}분</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#39393b]">공개 수준</Label>
                <Select value={draft.visibility} onValueChange={(value) => setDraftField('visibility', value as CalendarEventVisibility)}>
                  <SelectTrigger className="h-10 rounded-lg border-[#cacacb] bg-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CALENDAR_VISIBILITY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {draft.mode === 'personal' && (
                  <p className="flex items-center gap-1 text-[11px] font-medium text-[#707072]">
                    <LockKeyhole className="h-3 w-3" />
                    개인 일정은 기본 비공개이며 타인에게는 바쁨 상태만 보입니다.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#39393b]">팀 캘린더</Label>
                <Select value={draft.teamDepartment || 'none'} onValueChange={(value) => setDraftField('teamDepartment', value === 'none' ? '' : value)}>
                  <SelectTrigger className="h-10 rounded-lg border-[#cacacb] bg-white text-sm">
                    <SelectValue placeholder="팀 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">팀 지정 안함</SelectItem>
                    {draft.teamDepartment && !selectedTeam && (
                      <SelectItem value={draft.teamDepartment}>기존 팀 · {draft.teamDepartment}</SelectItem>
                    )}
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {draft.mode === 'team' && (
                  <p className="text-[11px] font-medium text-[#707072]">
                    {selectedTeam ? `${selectedTeam.members.length}명에게 상세 공개됩니다.` : '관리자가 만든 팀 캘린더를 선택하세요.'}
                  </p>
                )}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold text-[#39393b]">장소</Label>
                <Input
                  value={draft.location}
                  onChange={(event) => setDraftField('location', event.target.value)}
                  placeholder="회의실을 선택하면 자동으로 장소에 반영됩니다."
                  className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
                />
              </div>
              {draft.mode === 'client' && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#39393b]">고객/거래처</Label>
                    <Input
                      value={draft.clientName}
                      onChange={(event) => setDraftField('clientName', event.target.value)}
                      placeholder="회사명 또는 고객명"
                      className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#39393b]">담당자/연락처</Label>
                    <Input
                      value={draft.clientContact}
                      onChange={(event) => setDraftField('clientContact', event.target.value)}
                      placeholder="고객 담당자 또는 연락처"
                      className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
                <div className="flex items-center gap-2">
                  <Repeat2 className="h-4 w-4 text-[#707072]" />
                  <Label className="text-xs font-semibold text-[#39393b]">반복</Label>
                </div>
                <div className="mt-2 grid gap-2">
                  <Select value={draft.recurrenceFrequency} onValueChange={(value) => setDraftField('recurrenceFrequency', value as CalendarRecurrenceFrequency)}>
                    <SelectTrigger className="h-9 rounded-lg border-[#cacacb] bg-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRENCE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {draft.recurrenceFrequency !== 'none' && (
                    <div className="grid grid-cols-[88px_1fr] gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={draft.recurrenceInterval}
                        onChange={(event) => setDraftField('recurrenceInterval', event.target.value)}
                        className="h-9 rounded-lg border-[#cacacb] bg-white text-sm"
                      />
                      <Input
                        type="date"
                        value={draft.recurrenceUntil}
                        onChange={(event) => setDraftField('recurrenceUntil', event.target.value)}
                        className="h-9 rounded-lg border-[#cacacb] bg-white text-sm"
                      />
                    </div>
                  )}
                  {draft.recurrenceFrequency === 'weekly' && (
                    <div className="flex flex-wrap gap-1">
                      {WEEKDAY_OPTIONS.map((weekday) => {
                        const selected = draft.recurrenceWeekdays.includes(weekday.value);
                        return (
                          <button
                            key={weekday.value}
                            type="button"
                            onClick={() => toggleWeekday(weekday.value)}
                            className={cn(
                              'h-7 min-w-7 rounded-full border px-2 text-[11px] font-bold',
                              selected ? 'border-[#111111] bg-[#111111] text-white' : 'border-[#cacacb] bg-white text-[#707072]',
                            )}
                          >
                            {weekday.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
                <div className="flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-[#707072]" />
                  <Label className="text-xs font-semibold text-[#39393b]">알림</Label>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {REMINDER_OPTIONS.map((option) => {
                    const selected = draft.reminderMinutes.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggleReminder(option.value)}
                        className={cn(
                          'h-8 rounded-full border px-2.5 text-xs font-semibold',
                          selected ? 'border-[#111111] bg-[#111111] text-white' : 'border-[#cacacb] bg-white text-[#707072] hover:border-[#111111]',
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] font-medium text-[#707072]">앱 내부 알림 기준으로 저장됩니다.</p>
              </div>
            </div>

            {draft.mode !== 'holiday' && draft.mode !== 'personal' && draft.mode !== 'team' && renderEmployeePicker(draft.mode === 'client' ? '담당자 지정' : '참석자 지정')}

            {draft.mode === 'team' && selectedTeam && (
              <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
                <Label className="text-xs font-semibold text-[#39393b]">팀 구성원</Label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedTeam.members.map((member) => (
                    <Badge key={member.user_id} variant="outline" className="rounded-full bg-white px-2 py-1 text-[11px]">
                      {member.full_name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#39393b]">내용</Label>
              <Textarea
                value={draft.description}
                onChange={(event) => setDraftField('description', event.target.value)}
                placeholder={draft.mode === 'holiday' ? '휴무 사유나 운영 메모를 기록하세요.' : '안건, 준비물, 미팅 목적 등을 기록하세요.'}
                className="min-h-24 rounded-lg border-[#cacacb] bg-white text-sm"
              />
            </div>
          </div>

          <aside className="space-y-3">
            {draft.mode !== 'holiday' && draft.mode !== 'personal' && (
            <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-[#39393b]">회의실</Label>
                <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">
                  {draft.selectedResourceIds.length}개 선택
                </Badge>
              </div>
              <div className="mt-2 grid gap-2">
                {isResourcesLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-[#e5e5e5] bg-white p-3 text-sm text-[#707072]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    회의실을 불러오는 중
                  </div>
                ) : resources.map((resource) => {
                  const selected = draft.selectedResourceIds.includes(resource.id);
                  const conflicted = events.some((item) => eventOverlapsResource(item, resource.id, startIso, endIso, event?.id));
                  return (
                    <button
                      key={resource.id}
                      type="button"
                      onClick={() => toggleResource(resource.id)}
                      className={cn(
                        'rounded-lg border p-3 text-left transition-colors',
                        selected ? 'border-[#111111] bg-[#111111] text-white' : 'border-[#e5e5e5] bg-white text-[#111111] hover:border-[#cacacb]',
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{resource.name}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'rounded-full px-2 py-0 text-[10px]',
                            selected && 'border-white/30 text-white',
                            conflicted && !selected && 'border-red-200 bg-red-50 text-red-700',
                          )}
                        >
                          {conflicted ? '예약 불가' : '예약 가능'}
                        </Badge>
                      </span>
                      <span className={cn('mt-1 block text-xs', selected ? 'text-white/70' : 'text-[#707072]')}>
                        {resource.description || resource.floor || '회의실'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            <div className="rounded-lg border border-[#e5e5e5] bg-white p-3">
              <div className="flex items-center gap-2">
                <UsersRound className="h-4 w-4 text-[#707072]" />
                <p className="text-sm font-bold text-[#111111]">저장 요약</p>
              </div>
              <dl className="mt-3 grid gap-2 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-[#707072]">시간</dt>
                  <dd className="font-semibold text-[#111111]">{draft.date} {isAllDay ? '종일' : draft.startTime}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#707072]">종료</dt>
                  <dd className="font-semibold text-[#111111]">{isAllDay ? '다음 날 00:00' : addMinutesToClockTime(draft.startTime, Number(draft.durationMinutes))}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#707072]">공개</dt>
                  <dd className="font-semibold text-[#111111]">{CALENDAR_VISIBILITY_LABELS[draft.visibility]}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#707072]">반복</dt>
                  <dd className="font-semibold text-[#111111]">
                    {RECURRENCE_OPTIONS.find((option) => option.value === draft.recurrenceFrequency)?.label || '반복 안함'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#707072]">알림</dt>
                  <dd className="font-semibold text-[#111111]">{draft.reminderMinutes.length > 0 ? `${draft.reminderMinutes.length}개` : '없음'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#707072]">대상</dt>
                  <dd className="font-semibold text-[#111111]">
                    {draft.mode === 'holiday'
                      ? '회사 공용'
                      : draft.mode === 'personal'
                        ? '본인'
                        : draft.mode === 'team'
                          ? selectedTeam ? `${selectedTeam.name} ${selectedTeam.members.length}명` : '팀 미선택'
                          : `${draft.selectedUserIds.length}명`}
                  </dd>
                </div>
              </dl>
              {validationError && (
                <p className="mt-3 rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-2 text-xs font-medium text-[#707072]">
                  {validationError}
                </p>
              )}
            </div>
          </aside>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#e5e5e5] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {event?.can_edit && (
              <CalendarEventDeleteActions
                event={event}
                variant="dialog"
                disabled={saving}
                onDeleted={() => {
                  onSaved?.(event.id);
                  onOpenChange(false);
                }}
              />
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full border-[#cacacb]"
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              disabled={!!validationError || saving}
              onClick={handleSubmit}
              className="h-10 rounded-full bg-[#111111] px-5 text-white hover:bg-[#39393b]"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {event ? '변경 저장' : '일정 등록'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CalendarEventDialog;
