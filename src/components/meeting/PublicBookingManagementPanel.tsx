import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarCheck2, Check, ClipboardCopy, ExternalLink, KeyRound, Loader2, Plus, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useCalendarDirectory, useCalendarResources } from '@/hooks/useInternalCalendar';
import {
  generatePublicBookingSlug,
  getPublicBookingErrorMessage,
  useConfirmPublicBookingRequest,
  usePublicBookingLinks,
  usePublicBookingRequests,
  useRejectPublicBookingRequest,
  useSavePublicBookingLink,
} from '@/hooks/usePublicMeetingBookings';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { PublicBookingLinkDraft, PublicBookingLinkRow, PublicBookingLinkType, PublicBookingRequestRow } from '@/types/publicBooking';

const WEEKDAYS = [
  { value: 0, label: '일' },
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
];
const DURATION_OPTIONS = [30, 60, 90, 120, 180, 240];
const SLOT_OPTIONS = [15, 30, 60];
const STATUS_LABELS: Record<string, string> = {
  pending_review: '확정 대기',
  confirmed: '확정',
  rejected: '거절',
  canceled: '취소',
  expired: '만료',
};

function createDefaultDraft(resourceIds: string[]): PublicBookingLinkDraft {
  return {
    slug: generatePublicBookingSlug('booking'),
    link_type: 'customer_request',
    title: '고객 미팅 예약 요청',
    description: '상담 또는 방문 미팅을 요청해주세요. 담당자가 확인 후 확정합니다.',
    is_active: true,
    allowed_resource_ids: resourceIds.slice(0, 2),
    allowed_weekdays: [1, 2, 3, 4, 5],
    start_time: '09:00',
    end_time: '18:00',
    slot_minutes: 30,
    duration_minutes: 60,
    buffer_minutes: 0,
    min_notice_minutes: 120,
    max_days_ahead: 60,
    requires_approval: true,
    access_code: '',
    clear_access_code: false,
    notify_user_ids: [],
  };
}

function draftFromLink(link: PublicBookingLinkRow): PublicBookingLinkDraft {
  return {
    id: link.id,
    slug: link.slug,
    link_type: link.link_type,
    title: link.title,
    description: link.description || '',
    is_active: link.is_active,
    allowed_resource_ids: link.allowed_resource_ids || [],
    allowed_weekdays: link.allowed_weekdays || [],
    start_time: link.start_time.slice(0, 5),
    end_time: link.end_time.slice(0, 5),
    slot_minutes: link.slot_minutes,
    duration_minutes: link.duration_minutes,
    buffer_minutes: link.buffer_minutes,
    min_notice_minutes: link.min_notice_minutes,
    max_days_ahead: link.max_days_ahead,
    requires_approval: link.requires_approval,
    access_code: '',
    clear_access_code: false,
    notify_user_ids: link.notify_user_ids || [],
  };
}

function formatRequestDate(request: PublicBookingRequestRow) {
  const start = new Date(request.starts_at);
  const end = new Date(request.ends_at);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '-';
  return `${format(start, 'M월 d일 EEE HH:mm', { locale: ko })} - ${format(end, 'HH:mm')}`;
}

const PublicBookingManagementPanel = () => {
  const { user, isAdmin, isModerator } = useAuth();
  const canManage = isAdmin || isModerator;
  const { data: resources = [] } = useCalendarResources();
  const { data: employees = [] } = useCalendarDirectory();
  const { data: links = [], isLoading: isLinksLoading } = usePublicBookingLinks(canManage);
  const { data: requests = [], isLoading: isRequestsLoading } = usePublicBookingRequests(canManage);
  const saveLink = useSavePublicBookingLink(user?.id);
  const confirmRequest = useConfirmPublicBookingRequest();
  const rejectRequest = useRejectPublicBookingRequest();
  const [draft, setDraft] = useState<PublicBookingLinkDraft>(() => createDefaultDraft([]));

  const meetingRooms = useMemo(() => resources.filter((resource) => resource.resource_type === 'meeting_room'), [resources]);

  const resetDraft = () => setDraft(createDefaultDraft(meetingRooms.map((resource) => resource.id)));

  const updateDraft = <K extends keyof PublicBookingLinkDraft>(key: K, value: PublicBookingLinkDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const toggleResource = (resourceId: string) => {
    setDraft((prev) => ({
      ...prev,
      allowed_resource_ids: prev.allowed_resource_ids.includes(resourceId)
        ? prev.allowed_resource_ids.filter((id) => id !== resourceId)
        : [...prev.allowed_resource_ids, resourceId],
    }));
  };

  const toggleWeekday = (weekday: number) => {
    setDraft((prev) => ({
      ...prev,
      allowed_weekdays: prev.allowed_weekdays.includes(weekday)
        ? prev.allowed_weekdays.filter((day) => day !== weekday)
        : [...prev.allowed_weekdays, weekday].sort((a, b) => a - b),
    }));
  };

  const toggleNotifyUser = (userId: string) => {
    setDraft((prev) => ({
      ...prev,
      notify_user_ids: prev.notify_user_ids.includes(userId)
        ? prev.notify_user_ids.filter((id) => id !== userId)
        : [...prev.notify_user_ids, userId],
    }));
  };

  const setLinkType = (linkType: PublicBookingLinkType) => {
    setDraft((prev) => ({
      ...prev,
      link_type: linkType,
      title: linkType === 'partner_room' ? '공유회사 회의실 예약' : '고객 미팅 예약 요청',
      description: linkType === 'partner_room'
        ? '공유 사무실 파트너가 빈 회의실을 직접 예약합니다.'
        : '상담 또는 방문 미팅을 요청해주세요. 담당자가 확인 후 확정합니다.',
      requires_approval: linkType === 'customer_request',
      slug: generatePublicBookingSlug(linkType === 'partner_room' ? 'partner-room' : 'customer-booking'),
    }));
  };

  const submitLink = async () => {
    try {
      await saveLink.mutateAsync(draft);
      toast.success(draft.id ? '공개 예약 링크가 수정되었습니다.' : '공개 예약 링크가 생성되었습니다.');
      resetDraft();
    } catch (error) {
      toast.error(getPublicBookingErrorMessage(error, '링크 저장에 실패했습니다.'));
    }
  };

  const copyLink = async (slug: string) => {
    const url = `${window.location.origin}/public-booking/${slug}`;
    await navigator.clipboard.writeText(url);
    toast.success('공개 예약 링크를 복사했습니다.');
  };

  const quickToggleActive = async (link: PublicBookingLinkRow) => {
    try {
      await saveLink.mutateAsync({
        ...draftFromLink(link),
        is_active: !link.is_active,
      });
      toast.success(link.is_active ? '예약 링크를 비활성화했습니다.' : '예약 링크를 활성화했습니다.');
    } catch (error) {
      toast.error(getPublicBookingErrorMessage(error, '상태 변경에 실패했습니다.'));
    }
  };

  const handleConfirm = async (request: PublicBookingRequestRow) => {
    try {
      await confirmRequest.mutateAsync({ requestId: request.id });
      toast.success('예약 요청을 확정했습니다.');
    } catch (error) {
      toast.error(getPublicBookingErrorMessage(error, '예약 확정에 실패했습니다.'));
    }
  };

  const handleReject = async (request: PublicBookingRequestRow) => {
    const reason = window.prompt('거절 사유를 입력해주세요.');
    if (!reason?.trim()) return;
    try {
      await rejectRequest.mutateAsync({ requestId: request.id, reviewNote: reason.trim() });
      toast.success('예약 요청을 거절했습니다.');
    } catch (error) {
      toast.error(getPublicBookingErrorMessage(error, '예약 거절에 실패했습니다.'));
    }
  };

  if (!canManage) {
    return (
      <Alert>
        <AlertDescription>공개 예약 링크 관리는 관리자와 중간관리자만 사용할 수 있습니다.</AlertDescription>
      </Alert>
    );
  }

  return (
    <section className="w-full rounded-xl border border-border bg-card text-card-foreground shadow-none">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background">
              <CalendarCheck2 className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-lg font-bold">공개 예약 링크 관리</h2>
              <p className="text-sm text-muted-foreground">고객 요청과 공유회사 회의실 예약을 내부 캘린더에 연결합니다.</p>
            </div>
          </div>
        </div>
        <Button type="button" variant="outline" className="rounded-full" onClick={resetDraft}>
          <Plus className="mr-2 h-4 w-4" />
          새 링크
        </Button>
      </header>

      <Tabs defaultValue="requests" className="p-4 sm:p-5">
        <TabsList className="rounded-full">
          <TabsTrigger value="requests" className="rounded-full">외부 예약 요청</TabsTrigger>
          <TabsTrigger value="links" className="rounded-full">링크 설정</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4">
          <div className="rounded-lg border border-border">
            <div className="grid grid-cols-[1.1fr_1fr_120px_160px] border-b border-border bg-muted/40 px-4 py-3 text-xs font-semibold text-muted-foreground">
              <span>예약자</span>
              <span>일시/회의실</span>
              <span>상태</span>
              <span className="text-right">작업</span>
            </div>
            <div className="divide-y divide-border">
              {isRequestsLoading ? (
                <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  예약 요청을 불러오는 중입니다.
                </div>
              ) : requests.length > 0 ? requests.map((request) => (
                <div key={request.id} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[1.1fr_1fr_120px_160px] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{request.company_name || request.requester_name}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {request.requester_name}
                      {request.phone ? ` · ${request.phone}` : ''}
                      {request.email ? ` · ${request.email}` : ''}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{request.purpose}</p>
                  </div>
                  <div className="min-w-0 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">{formatRequestDate(request)}</p>
                    <p className="mt-1">{request.calendar_resources?.name || '회의실 미확인'}</p>
                    <p className="mt-1 truncate">{request.public_booking_links?.title || '공개 예약 링크'}</p>
                  </div>
                  <div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'rounded-full',
                        request.status === 'confirmed' && 'border-emerald-200 text-emerald-700',
                        request.status === 'rejected' && 'border-red-200 text-red-700',
                        request.status === 'pending_review' && 'border-amber-200 text-amber-700',
                      )}
                    >
                      {STATUS_LABELS[request.status] || request.status}
                    </Badge>
                  </div>
                  <div className="flex justify-start gap-2 md:justify-end">
                    {request.status === 'pending_review' ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => handleReject(request)}
                          disabled={rejectRequest.isPending}
                        >
                          <X className="mr-1 h-3.5 w-3.5" />
                          거절
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-full bg-foreground text-background hover:bg-foreground/90"
                          onClick={() => handleConfirm(request)}
                          disabled={confirmRequest.isPending}
                        >
                          <Check className="mr-1 h-3.5 w-3.5" />
                          확정
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {request.reviewed_at ? format(new Date(request.reviewed_at), 'M/d HH:mm') : '-'}
                      </span>
                    )}
                  </div>
                </div>
              )) : (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">외부 예약 요청이 없습니다.</div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="links" className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-border p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold">{draft.id ? '링크 수정' : '새 링크 생성'}</h3>
                <p className="text-xs text-muted-foreground">예약 유형별 동작과 가능 시간을 설정합니다.</p>
              </div>
              {draft.id && (
                <Button type="button" variant="ghost" size="sm" onClick={resetDraft}>
                  초기화
                </Button>
              )}
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>예약 링크 유형</Label>
                <Select value={draft.link_type} onValueChange={(value) => setLinkType(value as PublicBookingLinkType)}>
                  <SelectTrigger className="h-10 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer_request">고객 미팅 요청</SelectItem>
                    <SelectItem value="partner_room">공유회사 회의실 예약</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="publicBookingTitle">링크 이름</Label>
                <Input
                  id="publicBookingTitle"
                  value={draft.title}
                  onChange={(event) => updateDraft('title', event.target.value)}
                  className="h-10 rounded-lg"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="publicBookingSlug">공개 주소</Label>
                <Input
                  id="publicBookingSlug"
                  value={draft.slug}
                  onChange={(event) => updateDraft('slug', event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="h-10 rounded-lg font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">/public-booking/{draft.slug}</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="publicBookingDescription">설명</Label>
                <Textarea
                  id="publicBookingDescription"
                  value={draft.description || ''}
                  onChange={(event) => updateDraft('description', event.target.value)}
                  className="min-h-20 rounded-lg"
                />
              </div>

              <div className="grid gap-2">
                <Label>회의실</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {meetingRooms.map((resource) => (
                    <label key={resource.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                      <Checkbox
                        checked={draft.allowed_resource_ids.includes(resource.id)}
                        onCheckedChange={() => toggleResource(resource.id)}
                      />
                      <span>{resource.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Label>예약 가능 요일</Label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((weekday) => (
                    <button
                      key={weekday.value}
                      type="button"
                      onClick={() => toggleWeekday(weekday.value)}
                      className={cn(
                        'h-9 min-w-10 rounded-full border px-3 text-sm font-semibold',
                        draft.allowed_weekdays.includes(weekday.value)
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border bg-background text-foreground',
                      )}
                    >
                      {weekday.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>시작 시간</Label>
                  <Input type="time" value={draft.start_time} onChange={(event) => updateDraft('start_time', event.target.value)} className="h-10 rounded-lg" />
                </div>
                <div className="grid gap-2">
                  <Label>종료 시간</Label>
                  <Input type="time" value={draft.end_time} onChange={(event) => updateDraft('end_time', event.target.value)} className="h-10 rounded-lg" />
                </div>
                <div className="grid gap-2">
                  <Label>예약 단위</Label>
                  <Select value={String(draft.slot_minutes)} onValueChange={(value) => updateDraft('slot_minutes', Number(value))}>
                    <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>{SLOT_OPTIONS.map((value) => <SelectItem key={value} value={String(value)}>{value}분</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>기본 사용 시간</Label>
                  <Select value={String(draft.duration_minutes)} onValueChange={(value) => updateDraft('duration_minutes', Number(value))}>
                    <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>{DURATION_OPTIONS.map((value) => <SelectItem key={value} value={String(value)}>{value}분</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>최소 사전 예약</Label>
                  <Input type="number" min={0} value={draft.min_notice_minutes} onChange={(event) => updateDraft('min_notice_minutes', Number(event.target.value))} className="h-10 rounded-lg" />
                </div>
                <div className="grid gap-2">
                  <Label>최대 예약 가능일</Label>
                  <Input type="number" min={1} max={180} value={draft.max_days_ahead} onChange={(event) => updateDraft('max_days_ahead', Number(event.target.value))} className="h-10 rounded-lg" />
                </div>
              </div>

              <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="block font-semibold">관리자 확정 필요</span>
                    <span className="text-xs text-muted-foreground">고객 링크는 켜고, 공유회사 링크는 끄는 것을 권장합니다.</span>
                  </span>
                  <Switch checked={draft.requires_approval} onCheckedChange={(checked) => updateDraft('requires_approval', checked)} />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="block font-semibold">링크 활성화</span>
                    <span className="text-xs text-muted-foreground">끄면 공개 페이지에서 예약을 받을 수 없습니다.</span>
                  </span>
                  <Switch checked={draft.is_active} onCheckedChange={(checked) => updateDraft('is_active', checked)} />
                </label>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="publicBookingAccessCode">접근 코드</Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="publicBookingAccessCode"
                    value={draft.access_code || ''}
                    onChange={(event) => updateDraft('access_code', event.target.value)}
                    placeholder={draft.id ? '새 코드 입력 시 교체됩니다' : '선택 사항'}
                    className="h-10 rounded-lg pl-9"
                  />
                </div>
                {draft.id && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox checked={Boolean(draft.clear_access_code)} onCheckedChange={(checked) => updateDraft('clear_access_code', Boolean(checked))} />
                    기존 접근 코드 제거
                  </label>
                )}
              </div>

              <div className="grid gap-2">
                <Label>알림 대상</Label>
                <div className="grid max-h-32 gap-2 overflow-auto rounded-lg border border-border p-2 sm:grid-cols-2">
                  {employees.map((employee) => (
                    <label key={employee.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/60">
                      <Checkbox
                        checked={draft.notify_user_ids.includes(employee.id)}
                        onCheckedChange={() => toggleNotifyUser(employee.id)}
                      />
                      <span className="truncate">{employee.full_name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">선택하지 않으면 관리자/중간관리자 전체에게 알림을 보냅니다.</p>
              </div>

              <Button
                type="button"
                onClick={submitLink}
                disabled={saveLink.isPending}
                className="rounded-full bg-foreground text-background hover:bg-foreground/90"
              >
                {saveLink.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                {draft.id ? '링크 수정하기' : '링크 생성하기'}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-bold">생성된 링크</h3>
              {isLinksLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="divide-y divide-border">
              {links.length > 0 ? links.map((link) => (
                <div key={link.id} className="grid gap-3 px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{link.title}</p>
                        <Badge variant="outline" className="rounded-full">
                          {link.link_type === 'partner_room' ? '공유회사' : '고객'}
                        </Badge>
                        <Badge variant={link.is_active ? 'default' : 'secondary'} className="rounded-full">
                          {link.is_active ? '활성' : '비활성'}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-muted-foreground">/public-booking/{link.slug}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {link.start_time.slice(0, 5)}-{link.end_time.slice(0, 5)} / {link.duration_minutes}분 / {link.requires_approval ? '관리자 확정' : '자동 확정'}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => copyLink(link.slug)}>
                        <ClipboardCopy className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => window.open(`/public-booking/${link.slug}`, '_blank')}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => setDraft(draftFromLink(link))}>
                      수정
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => quickToggleActive(link)}>
                      <RefreshCw className="mr-1 h-3.5 w-3.5" />
                      {link.is_active ? '비활성화' : '활성화'}
                    </Button>
                  </div>
                </div>
              )) : (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">생성된 공개 예약 링크가 없습니다.</div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
};

export default PublicBookingManagementPanel;
