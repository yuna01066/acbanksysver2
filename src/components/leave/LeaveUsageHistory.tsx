import React, { useState, useMemo, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { type LeaveRequest, type LeaveCancellationRequest, LEAVE_TYPES, LEAVE_STATUS } from '@/hooks/useLeaveRequests';
import { EXTENDED_LEAVE_TYPES } from './LeaveTypeCards';

interface LeaveUsageHistoryProps {
  requests: LeaveRequest[];
  cancellations: LeaveCancellationRequest[];
  currentUserId: string;
  onCancel: (id: string) => Promise<unknown>;
  onRequestCancellation: (id: string, reason: string) => Promise<unknown>;
  compact?: boolean;
  focusedRequestId?: string;
}

const LeaveUsageHistory: React.FC<LeaveUsageHistoryProps> = ({
  requests, cancellations, currentUserId, onCancel, onRequestCancellation, compact = false, focusedRequestId,
}) => {
  const lock = useRef(false);
  const focused = useRef<string>();
  const [busy, setBusy] = useState(false);
  const run = async (operation: () => Promise<unknown>) => {
    if (lock.current) return false;
    lock.current = true; setBusy(true);
    try { return await operation(); }
    catch { toast.error('처리 결과를 확인하지 못했습니다. 최신 기록을 확인해 주세요.'); return false; }
    finally { lock.current = false; setBusy(false); }
  };
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    if (!focusedRequestId || focused.current === focusedRequestId) return;
    const request = requests.find(r => r.id === focusedRequestId);
    if (!request) return;
    focused.current = focusedRequestId;
    setSelectedYear(new Date(request.start_date).getFullYear());
    setIncludeInactive(true);
  }, [focusedRequestId, requests]);

  const years = useMemo(() => {
    const ys = new Set<number>();
    requests.forEach(r => ys.add(new Date(r.start_date).getFullYear()));
    ys.add(currentYear);
    return Array.from(ys).sort((a, b) => b - a);
  }, [requests, currentYear]);

  const filtered = useMemo(() => {
    return requests.filter(r => {
      const year = new Date(r.start_date).getFullYear();
      if (year !== selectedYear) return false;
      if (!includeInactive && (r.status === 'rejected' || r.status === 'cancelled')) return false;
      return true;
    });
  }, [requests, selectedYear, includeInactive]);

  const submitCancellation = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    const ok = await run(() => onRequestCancellation(cancelTarget, cancelReason.trim()));
    if (ok !== false) {
      setCancelTarget(null);
      setCancelReason('');
    }
  };

  const getLeaveLabel = (key: string) => {
    const ext = EXTENDED_LEAVE_TYPES.find(t => t.key === key);
    if (ext) return ext.label;
    return LEAVE_TYPES[key] || key;
  };

  return (
    <div>
      <div className={compact ? 'mb-3 flex flex-col gap-2' : 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4'}>
        {!compact && <h2 className="text-lg font-semibold">신청·사용 기록</h2>}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            반려·취소 기록 포함
            <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} aria-label="반려 및 취소 기록 표시" />
          </label>
          <div className="flex items-center gap-1">
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[100px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}년</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedYear(y => y - 1)} aria-label="이전 연도">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedYear(y => y + 1)} aria-label="다음 연도">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={compact ? 'rounded-lg bg-muted/30 border py-8 flex flex-col items-center justify-center text-muted-foreground' : 'rounded-lg bg-muted/30 border py-12 flex flex-col items-center justify-center text-muted-foreground'}>
          <Info className="h-6 w-6 mb-2" />
          <p className="text-sm">해당 연도의 휴가 기록이 없습니다.</p>
        </div>
      ) : (
        <div className={compact ? 'space-y-2' : 'space-y-3'}>
          {filtered.map(req => {
            const status = LEAVE_STATUS[req.status] || LEAVE_STATUS.pending;
            const pendingCancellation = cancellations.find(c => c.leave_request_id === req.id && c.status === 'pending');
            const canCancelPending = req.user_id === currentUserId && req.status === 'pending';
            const canRequestCancellation = req.user_id === currentUserId
              && req.status === 'approved'
              && req.start_date > format(new Date(), 'yyyy-MM-dd')
              && !pendingCancellation;

            return (
              <div key={req.id} data-focused={focusedRequestId === req.id || undefined} className={compact ? 'border rounded-lg p-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3 data-[focused]:border-primary' : 'border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 data-[focused]:border-primary'}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">{getLeaveLabel(req.leave_type)}</Badge>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
                    {req.status === 'approved' && req.start_date > format(new Date(), 'yyyy-MM-dd') && <Badge variant="outline">예정 · 사용 반영</Badge>}
                    {pendingCancellation && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">취소 승인 대기</Badge>}
                  </div>
                  <p className="text-sm">
                    {format(new Date(req.start_date), 'yyyy.MM.dd (EEE)', { locale: ko })}
                    {req.start_date !== req.end_date && (
                      <> ~ {format(new Date(req.end_date), 'yyyy.MM.dd (EEE)', { locale: ko })}</>
                    )}
                    <span className="ml-2 font-medium text-primary">{req.days}일</span>
                  </p>
                  {req.reason && <p className="text-xs text-muted-foreground mt-1">{req.reason}</p>}
                  {req.status === 'rejected' && req.reject_reason && (
                    <p className="text-xs text-destructive mt-1">반려 사유: {req.reject_reason}</p>
                  )}
                </div>
                {canCancelPending && (
                  <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={busy} onClick={() => void run(() => onCancel(req.id))}>
                    신청 취소
                  </Button>
                )}
                {canRequestCancellation && (
                  <Button variant="outline" size="sm" onClick={() => setCancelTarget(req.id)}>
                    취소 요청
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && !busy && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>승인된 휴가 취소 요청</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">관리자 승인 전까지 기존 휴가 일정은 유지됩니다.</p>
          <Textarea
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="취소 사유를 입력하세요"
            aria-label="휴가 취소 사유"
          />
          <Button onClick={submitCancellation} disabled={busy || !cancelReason.trim()}>취소 승인 요청</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveUsageHistory;
