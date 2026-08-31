import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ArrowLeft, CalendarClock, Check, ExternalLink, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPublicBookingErrorMessage,
  useConfirmPublicBookingRequest,
  usePublicBookingRequestEvents,
  usePublicBookingRequests,
  useRejectPublicBookingRequest,
} from '@/hooks/usePublicMeetingBookings';
import type {
  PublicBookingRequestEventType,
  PublicBookingRequestRow,
  PublicBookingRequestStatus,
} from '@/types/publicBooking';

const EVENT_LABELS: Record<PublicBookingRequestEventType, string> = {
  requested: '예약 요청 접수',
  auto_confirmed: '자동 확정',
  confirmed: '승인 · 확정',
  rejected: '거절',
  canceled: '취소',
  expired: '만료',
  note: '메모',
};

const EVENT_DOT_CLASS: Record<PublicBookingRequestEventType, string> = {
  requested: 'bg-muted-foreground',
  auto_confirmed: 'bg-emerald-500',
  confirmed: 'bg-emerald-500',
  rejected: 'bg-red-500',
  canceled: 'bg-muted-foreground',
  expired: 'bg-muted-foreground',
  note: 'bg-primary',
};

const RequestEventTimeline = ({ requestId }: { requestId: string }) => {
  const { data: events = [], isLoading } = usePublicBookingRequestEvents(requestId);

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-sm font-semibold">처리 이력</p>
      {isLoading ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          이력을 불러오는 중입니다.
        </p>
      ) : events.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">기록된 처리 이력이 없습니다.</p>
      ) : (
        <ol className="mt-2 space-y-2">
          {events.map((event) => (
            <li key={event.id} className="flex gap-2">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${EVENT_DOT_CLASS[event.event_type] || 'bg-muted-foreground'}`} />
              <div className="min-w-0 space-y-0.5">
                <p className="text-xs font-medium">
                  {EVENT_LABELS[event.event_type] || event.event_type}
                  {event.to_status ? (
                    <span className="text-muted-foreground">
                      {' '}· {STATUS_LABELS[event.to_status] || event.to_status}
                    </span>
                  ) : null}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {format(new Date(event.created_at), 'yyyy-MM-dd HH:mm')}
                  {event.actor_label ? ` · ${event.actor_label}` : ''}
                </p>
                {event.note ? (
                  <p className="whitespace-pre-wrap text-[11px] text-muted-foreground">{event.note}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

const STATUS_LABELS: Record<string, string> = {
  pending_review: '승인 대기',
  confirmed: '확정',
  rejected: '거절',
  canceled: '취소',
  expired: '만료',
};

const STATUS_CLASS: Record<string, string> = {
  pending_review: 'border-amber-200 bg-amber-50 text-amber-700',
  confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-red-200 bg-red-50 text-red-700',
  canceled: 'border-border bg-muted text-muted-foreground',
  expired: 'border-border bg-muted text-muted-foreground',
};

const MODE_LABELS: Record<string, string> = {
  visit: '방문',
  phone: '전화',
  online: '온라인',
};

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: 'pending_review', label: '승인 대기' },
  { value: 'confirmed', label: '확정' },
  { value: 'rejected', label: '거절' },
  { value: 'all', label: '전체' },
];

function formatSlot(request: PublicBookingRequestRow) {
  const start = new Date(request.starts_at);
  const end = new Date(request.ends_at);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '-';
  return `${format(start, 'yyyy년 M월 d일 (EEE) HH:mm', { locale: ko })} ~ ${format(end, 'HH:mm')}`;
}

const PublicBookingApprovalsPage = () => {
  const navigate = useNavigate();
  const { isAdmin, isModerator } = useAuth();
  const canManage = isAdmin || isModerator;

  const { data: requests = [], isLoading, isFetching, refetch } = usePublicBookingRequests(canManage);
  const confirmRequest = useConfirmPublicBookingRequest();
  const rejectRequest = useRejectPublicBookingRequest();

  const [statusFilter, setStatusFilter] = useState<string>('pending_review');
  const [linkFilter, setLinkFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PublicBookingRequestRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PublicBookingRequestRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const linkOptions = useMemo(() => {
    const map = new Map<string, string>();
    requests.forEach((request) => {
      if (request.public_booking_links) {
        map.set(request.public_booking_links.id, request.public_booking_links.title);
      }
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [requests]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return requests.filter((request) => {
      if (statusFilter !== 'all' && request.status !== statusFilter) return false;
      if (linkFilter !== 'all' && request.link_id !== linkFilter) return false;
      if (!keyword) return true;
      return [
        request.requester_name,
        request.company_name,
        request.phone,
        request.email,
        request.purpose,
        request.notes,
        request.public_booking_links?.title,
        request.calendar_resources?.name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [requests, statusFilter, linkFilter, search]);

  const pendingCount = useMemo(
    () => requests.filter((request) => request.status === 'pending_review').length,
    [requests],
  );

  const handleConfirm = async (request: PublicBookingRequestRow) => {
    try {
      await confirmRequest.mutateAsync({ requestId: request.id });
      toast.success('예약 요청을 승인했습니다. 담당자에게 알림이 발송되었습니다.');
      setSelected((current) =>
        current && current.id === request.id
          ? { ...current, status: 'confirmed', reviewed_at: new Date().toISOString() }
          : current,
      );
    } catch (error) {
      toast.error(getPublicBookingErrorMessage(error, '예약 승인에 실패했습니다.'));
    }
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast.error('거절 사유를 입력해주세요.');
      return;
    }
    try {
      await rejectRequest.mutateAsync({ requestId: rejectTarget.id, reviewNote: reason });
      toast.success('예약 요청을 거절했습니다. 담당자에게 알림이 발송되었습니다.');
      setSelected((current) =>
        current && current.id === rejectTarget.id
          ? { ...current, status: 'rejected', review_note: reason, reviewed_at: new Date().toISOString() }
          : current,
      );
      setRejectTarget(null);
      setRejectReason('');
    } catch (error) {
      toast.error(getPublicBookingErrorMessage(error, '예약 거절에 실패했습니다.'));
    }
  };

  const statusBadge = (status: PublicBookingRequestStatus) => (
    <Badge variant="outline" className={STATUS_CLASS[status] || 'border-border bg-muted text-muted-foreground'}>
      {STATUS_LABELS[status] || status}
    </Badge>
  );

  if (!canManage) {
    return (
      <PageShell maxWidth="5xl">
        <Alert>
          <AlertDescription>공개 예약 승인 관리는 관리자와 중간관리자만 사용할 수 있습니다.</AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="7xl">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" className="rounded-full" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          뒤로
        </Button>
        <Button type="button" variant="outline" className="rounded-full" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          새로고침
        </Button>
      </div>

      <PageHeader
        title="공개 예약 승인 관리"
        description={`공개 링크로 접수된 예약 요청을 확인하고 승인 또는 거절합니다. 현재 승인 대기 ${pendingCount}건`}
        icon={<CalendarClock className="h-5 w-5" />}
      />

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[200px_240px_1fr]">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">상태</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">공개 링크</Label>
            <Select value={linkFilter} onValueChange={setLinkFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 링크</SelectItem>
                {linkOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>{option.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">검색</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="예약자, 회사, 연락처, 목적으로 검색"
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center gap-2 px-4 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              예약 요청을 불러오는 중입니다.
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              조건에 맞는 예약 요청이 없습니다.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((request) => (
                <li key={request.id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{request.requester_name}</span>
                      {request.company_name ? (
                        <span className="text-sm text-muted-foreground">{request.company_name}</span>
                      ) : null}
                      {statusBadge(request.status)}
                      <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                        {MODE_LABELS[request.meeting_mode] || request.meeting_mode}
                      </Badge>
                    </div>
                    <p className="text-sm">{formatSlot(request)}</p>
                    <p className="text-xs text-muted-foreground">
                      {request.public_booking_links?.title || '삭제된 링크'}
                      {request.calendar_resources?.name ? ` · ${request.calendar_resources.name}` : ''}
                      {request.assigned_profile?.full_name ? ` · 담당 ${request.assigned_profile.full_name}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setSelected(request)}>
                      상세 보기
                    </Button>
                    {request.status === 'pending_review' ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-full"
                          disabled={confirmRequest.isPending}
                          onClick={() => handleConfirm(request)}
                        >
                          <Check className="mr-1.5 h-4 w-4" />
                          승인
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => { setRejectTarget(request); setRejectReason(''); }}
                        >
                          <X className="mr-1.5 h-4 w-4" />
                          거절
                        </Button>
                      </>
                    ) : null}
                    {request.public_booking_links?.slug ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full"
                        onClick={() => window.open(`/public-booking/${request.public_booking_links?.slug}`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>예약 요청 상세</DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">{statusBadge(selected.status)}
                <span className="text-muted-foreground">{selected.public_booking_links?.title}</span>
              </div>
              <dl className="grid grid-cols-[100px_1fr] gap-y-2">
                <dt className="text-muted-foreground">일시</dt><dd>{formatSlot(selected)}</dd>
                <dt className="text-muted-foreground">예약자</dt><dd>{selected.requester_name}</dd>
                <dt className="text-muted-foreground">회사</dt><dd>{selected.company_name || '-'}</dd>
                <dt className="text-muted-foreground">연락처</dt><dd>{selected.phone || '-'}</dd>
                <dt className="text-muted-foreground">이메일</dt><dd>{selected.email || '-'}</dd>
                <dt className="text-muted-foreground">회의실</dt><dd>{selected.calendar_resources?.name || '-'}</dd>
                <dt className="text-muted-foreground">방식</dt><dd>{MODE_LABELS[selected.meeting_mode] || selected.meeting_mode}</dd>
                <dt className="text-muted-foreground">목적</dt><dd className="whitespace-pre-wrap">{selected.purpose}</dd>
                <dt className="text-muted-foreground">메모</dt><dd className="whitespace-pre-wrap">{selected.notes || '-'}</dd>
                <dt className="text-muted-foreground">검토 메모</dt><dd className="whitespace-pre-wrap">{selected.review_note || '-'}</dd>
                <dt className="text-muted-foreground">접수 시각</dt>
                <dd>{format(new Date(selected.created_at), 'yyyy-MM-dd HH:mm')}</dd>
              </dl>
            </div>
          ) : null}
          <DialogFooter>
            {selected?.status === 'pending_review' ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => { setRejectTarget(selected); setRejectReason(''); }}
                >
                  거절
                </Button>
                <Button
                  type="button"
                  className="rounded-full"
                  disabled={confirmRequest.isPending}
                  onClick={() => handleConfirm(selected)}
                >
                  승인
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setSelected(null)}>
                닫기
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>예약 요청 거절</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">거절 사유</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={4}
              placeholder="신청자에게 전달할 거절 사유를 입력해주세요."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setRejectTarget(null)}>
              취소
            </Button>
            <Button type="button" className="rounded-full" disabled={rejectRequest.isPending} onClick={submitReject}>
              거절 확정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default PublicBookingApprovalsPage;
