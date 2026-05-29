import { useEffect, useMemo, useState } from 'react';
import { differenceInMinutes, format } from 'date-fns';
import { CalendarCheck2, Check, Loader2, Search, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  addMinutesToClockTime,
  toSeoulDateTime,
  useCalendarDirectory,
  useCalendarResources,
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
} from '@/hooks/useInternalCalendar';
import {
  CALENDAR_VISIBILITY_LABELS,
  type CalendarDirectoryUser,
  type CalendarEventStatus,
  type CalendarEventVisibility,
  type InternalCalendarEvent,
} from '@/types/internalCalendar';

type CalendarDialogMode = 'employee' | 'client' | 'room' | 'manual';

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
  teamDepartment: string;
  selectedUserIds: string[];
  selectedResourceIds: string[];
  clientName: string;
  clientContact: string;
};

const DURATION_OPTIONS = [30, 60, 90, 120, 180];
const TIME_OPTIONS = Array.from({ length: 25 }, (_, index) => {
  const totalMinutes = 8 * 60 + index * 30;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

const todayString = () => format(new Date(), 'yyyy-MM-dd');

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
    return {
      mode: defaultMode,
      title: '',
      date: defaultDate || todayString(),
      startTime: '10:00',
      durationMinutes: '60',
      description: '',
      location: '',
      visibility: 'title_only',
      status: 'scheduled',
      teamDepartment: '',
      selectedUserIds: [],
      selectedResourceIds: [],
      clientName: '',
      clientContact: '',
    };
  }

  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);
  const duration = Math.max(30, differenceInMinutes(end, start));
  const eventMode = (event.metadata?.calendar_kind as CalendarDialogMode | undefined)
    || (event.client_name ? 'client' : event.resource_ids.length > 0 ? 'room' : 'employee');

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
    teamDepartment: event.team_department || '',
    selectedUserIds: event.participant_ids.filter((id) => id !== event.created_by),
    selectedResourceIds: event.resource_ids,
    clientName: event.client_name || '',
    clientContact: event.client_contact || '',
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
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const saving = createEvent.isPending || updateEvent.isPending;

  useEffect(() => {
    if (!open) return;
    setDraft(getInitialDraft({ event, defaultDate, defaultMode }));
    setEmployeeSearch('');
  }, [defaultDate, defaultMode, event, open]);

  const departmentOptions = useMemo(() => {
    return [...new Set(employees.map((employee) => employee.department).filter(Boolean) as string[])].sort();
  }, [employees]);

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
  const startIso = toSeoulDateTime(draft.date, draft.startTime);
  const endIso = toSeoulDateTime(draft.date, addMinutesToClockTime(draft.startTime, Number(draft.durationMinutes)));

  const conflictingResourceNames = selectedResources
    .filter((resource) => events.some((item) => eventOverlapsResource(item, resource.id, startIso, endIso, event?.id)))
    .map((resource) => resource.name);

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
    if (!draft.date || !draft.startTime) return '일정 날짜와 시간을 선택해주세요.';
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
  }, [conflictingResourceNames, draft.date, draft.mode, draft.selectedResourceIds.length, draft.selectedUserIds.length, draft.startTime, draft.teamDepartment, draft.title]);

  const handleSubmit = async () => {
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const resourceLocation = selectedResources.map((resource) => resource.name).join(', ');
    const payload = {
      ...(event ? { id: event.id } : {}),
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      starts_at: startIso,
      ends_at: endIso,
      location: resourceLocation || draft.location.trim() || null,
      visibility: draft.visibility,
      status: draft.status,
      team_department: draft.teamDepartment || null,
      client_name: draft.mode === 'client' ? draft.clientName.trim() || null : null,
      client_contact: draft.mode === 'client' ? draft.clientContact.trim() || null : null,
      participant_ids: draft.mode === 'client' ? [] : draft.selectedUserIds,
      assignee_ids: draft.mode === 'client' ? draft.selectedUserIds : [],
      resource_ids: draft.selectedResourceIds,
      metadata: {
        ...(event?.metadata || {}),
        calendar_kind: draft.mode,
      },
    };

    try {
      const savedId = event
        ? await updateEvent.mutateAsync(payload)
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
              {[
                { value: 'employee', label: '직원 미팅' },
                { value: 'client', label: '클라이언트' },
                { value: 'room', label: '회의실 예약' },
                { value: 'manual', label: '일반 일정' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDraftField('mode', option.value as CalendarDialogMode)}
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
                  placeholder="예: 1:1 미팅, 제작 상담, 회의실 예약"
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
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#39393b]">팀 캘린더</Label>
                <Select value={draft.teamDepartment || 'none'} onValueChange={(value) => setDraftField('teamDepartment', value === 'none' ? '' : value)}>
                  <SelectTrigger className="h-10 rounded-lg border-[#cacacb] bg-white text-sm">
                    <SelectValue placeholder="팀 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">팀 지정 안함</SelectItem>
                    {departmentOptions.map((department) => (
                      <SelectItem key={department} value={department}>{department}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

            {renderEmployeePicker(draft.mode === 'client' ? '담당자 지정' : '참석자 지정')}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#39393b]">내용</Label>
              <Textarea
                value={draft.description}
                onChange={(event) => setDraftField('description', event.target.value)}
                placeholder="안건, 준비물, 미팅 목적 등을 기록하세요."
                className="min-h-24 rounded-lg border-[#cacacb] bg-white text-sm"
              />
            </div>
          </div>

          <aside className="space-y-3">
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

            <div className="rounded-lg border border-[#e5e5e5] bg-white p-3">
              <div className="flex items-center gap-2">
                <UsersRound className="h-4 w-4 text-[#707072]" />
                <p className="text-sm font-bold text-[#111111]">저장 요약</p>
              </div>
              <dl className="mt-3 grid gap-2 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-[#707072]">시간</dt>
                  <dd className="font-semibold text-[#111111]">{draft.date} {draft.startTime}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#707072]">종료</dt>
                  <dd className="font-semibold text-[#111111]">{addMinutesToClockTime(draft.startTime, Number(draft.durationMinutes))}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#707072]">공개</dt>
                  <dd className="font-semibold text-[#111111]">{CALENDAR_VISIBILITY_LABELS[draft.visibility]}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#707072]">대상</dt>
                  <dd className="font-semibold text-[#111111]">{draft.selectedUserIds.length}명</dd>
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

        <div className="flex flex-col-reverse gap-2 border-t border-[#e5e5e5] px-5 py-4 sm:flex-row sm:justify-end">
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
      </DialogContent>
    </Dialog>
  );
};

export default CalendarEventDialog;
