import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { type LeaveRequest, type LeaveCancellationRequest, LEAVE_TYPES, LEAVE_STATUS } from '@/hooks/useLeaveRequests';

interface LeaveRequestListProps {
  requests: LeaveRequest[];
  cancellations: LeaveCancellationRequest[];
  isAdmin: boolean;
  currentUserId: string;
  onApprove: (id: string) => Promise<unknown>;
  onReject: (id: string, reason: string) => Promise<unknown>;
  onCancel: (id: string) => Promise<unknown>;
  onReviewCancellation: (id: string, decision: 'approved' | 'rejected', note?: string) => Promise<unknown>;
  onAdminCancel: (id: string, reason: string) => Promise<unknown>;
  focusedRequestId?: string;
}

const LeaveRequestList: React.FC<LeaveRequestListProps> = ({
  requests, cancellations, isAdmin, currentUserId, onApprove, onReject, onCancel,
  onReviewCancellation, onAdminCancel, focusedRequestId,
}) => {
  const [action, setAction] = useState<{ kind: 'reject' | 'cancel-reject' | 'admin-cancel'; id: string } | null>(null);
  const [reason, setReason] = useState('');

  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = async (operation: () => Promise<unknown>) => {
    if (lock.current) return false;
    lock.current = true; setBusy(true);
    try { return await operation(); }
    catch { toast.error('처리 결과를 확인하지 못했습니다. 목록을 확인한 뒤 다시 시도해 주세요.'); return false; }
    finally { lock.current = false; setBusy(false); }
  };

  useEffect(() => {
    if (!focusedRequestId) return;
    document.getElementById(`leave-request-${focusedRequestId}`)?.scrollIntoView({ block: 'center' });
  }, [focusedRequestId]);

  const handleAction = async () => {
    if (!action || !reason.trim()) return;
    const result = await run(() => action.kind === 'reject' ? onReject(action.id, reason.trim())
      : action.kind === 'cancel-reject' ? onReviewCancellation(action.id, 'rejected', reason.trim())
      : onAdminCancel(action.id, reason.trim()));
    if (result === false) return;
    setAction(null);
    setReason('');
  };

  if (requests.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">신청 내역이 없습니다.</p>;
  }

  return (
    <>
      <div className="space-y-3">
        {[...requests].sort((a, b) => {
          const aPending = cancellations.some(c => c.leave_request_id === a.id && c.status === 'pending');
          const bPending = cancellations.some(c => c.leave_request_id === b.id && c.status === 'pending');
          return Number(bPending) - Number(aPending);
        }).map(req => {
          const status = LEAVE_STATUS[req.status] || LEAVE_STATUS.pending;
          const isOwn = req.user_id === currentUserId;
          const canCancel = isOwn && req.status === 'pending';
          const canApprove = isAdmin && req.status === 'pending';
          const cancellation = cancellations.find(c => c.leave_request_id === req.id && c.status === 'pending');
          const canAdminCancel = isAdmin && req.status === 'approved' && !cancellation;

          return (
            <div
              key={req.id}
              id={`leave-request-${req.id}`}
              className={`border rounded-lg p-4 ${focusedRequestId === req.id ? 'border-primary bg-primary/5' : ''}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {isAdmin && <span className="text-sm font-semibold">{req.user_name}</span>}
                    <Badge variant="outline" className="text-xs">{LEAVE_TYPES[req.leave_type] || req.leave_type}</Badge>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
                    {req.status === 'approved' && req.start_date > format(new Date(), 'yyyy-MM-dd') && <Badge variant="outline">예정 · 사용 반영</Badge>}
                  </div>
                  <p className="text-sm">
                    {format(new Date(req.start_date), 'yyyy.MM.dd (EEE)', { locale: ko })}
                    {req.start_date !== req.end_date && (
                      <> ~ {format(new Date(req.end_date), 'yyyy.MM.dd (EEE)', { locale: ko })}</>
                    )}
                    <span className="ml-2 font-medium text-primary">{req.days}일</span>
                  </p>
                  {req.reason && <p className="text-xs text-muted-foreground mt-1">{req.reason}</p>}
                  {req.status === 'approved' && req.approved_by_name && (
                    <p className="text-xs text-muted-foreground mt-1">승인: {req.approved_by_name}</p>
                  )}
                  {req.status === 'rejected' && req.reject_reason && (
                    <p className="text-xs text-destructive mt-1">반려 사유: {req.reject_reason}</p>
                  )}
                  {cancellation && (
                    <div className="mt-3 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm dark:bg-amber-950/20">
                      <p className="font-medium text-amber-900 dark:text-amber-200">취소 승인 대기</p>
                      <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">{cancellation.reason}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap justify-end gap-2 shrink-0">
                  {canApprove && (
                    <>
                      <Button disabled={busy} variant="outline" size="sm" className="text-green-700" onClick={() => void run(() => onApprove(req.id))}>승인</Button>
                      <Button disabled={busy} variant="outline" size="sm" className="text-destructive" onClick={() => setAction({ kind: 'reject', id: req.id })}>반려</Button>
                    </>
                  )}
                  {isAdmin && cancellation && (
                    <>
                      <Button disabled={busy} size="sm" onClick={() => void run(() => onReviewCancellation(cancellation.id, 'approved'))}>취소 승인</Button>
                      <Button disabled={busy} variant="outline" size="sm" onClick={() => setAction({ kind: 'cancel-reject', id: cancellation.id })}>취소 반려</Button>
                    </>
                  )}
                  {canAdminCancel && (
                    <Button disabled={busy} variant="outline" size="sm" onClick={() => setAction({ kind: 'admin-cancel', id: req.id })}>관리자 취소</Button>
                  )}
                  {canCancel && (
                    <Button disabled={busy} variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void run(() => onCancel(req.id))}>신청 취소</Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!action} onOpenChange={(open) => !open && !busy && setAction(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{action?.kind === 'admin-cancel' ? '관리자 휴가 취소' : '반려 사유'}</DialogTitle>
            <DialogDescription>처리 사유는 이력에 보존됩니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="사유를 입력하세요" aria-label="처리 사유" />
            <Button onClick={handleAction} disabled={busy || !reason.trim()} className="w-full">
              {action?.kind === 'admin-cancel' ? '휴가 취소' : '반려'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LeaveRequestList;
