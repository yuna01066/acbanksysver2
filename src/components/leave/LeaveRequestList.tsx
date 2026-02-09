import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Check, X, Trash2, MessageSquare } from 'lucide-react';
import { type LeaveRequest, LEAVE_TYPES, LEAVE_STATUS } from '@/hooks/useLeaveRequests';

interface LeaveRequestListProps {
  requests: LeaveRequest[];
  isAdmin: boolean;
  currentUserId: string;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}

const LeaveRequestList: React.FC<LeaveRequestListProps> = ({
  requests, isAdmin, currentUserId, onApprove, onReject, onCancel,
}) => {
  const [rejectDialogId, setRejectDialogId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleReject = async () => {
    if (!rejectDialogId) return;
    await onReject(rejectDialogId, rejectReason);
    setRejectDialogId(null);
    setRejectReason('');
  };

  if (requests.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">신청 내역이 없습니다.</p>;
  }

  return (
    <>
      <div className="space-y-3">
        {requests.map(req => {
          const status = LEAVE_STATUS[req.status] || LEAVE_STATUS.pending;
          const isOwn = req.user_id === currentUserId;
          const canCancel = isOwn && req.status === 'pending';
          const canApprove = isAdmin && req.status === 'pending';

          return (
            <div key={req.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {isAdmin && <span className="text-sm font-semibold">{req.user_name}</span>}
                    <Badge variant="outline" className="text-xs">{LEAVE_TYPES[req.leave_type] || req.leave_type}</Badge>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
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
                </div>
                <div className="flex gap-1 shrink-0">
                  {canApprove && (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700" onClick={() => onApprove(req.id)} title="승인">
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => setRejectDialogId(req.id)} title="반려">
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {canCancel && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => onCancel(req.id)} title="취소">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!rejectDialogId} onOpenChange={() => setRejectDialogId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>반려 사유</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="반려 사유를 입력하세요" />
            <Button onClick={handleReject} disabled={!rejectReason.trim()} className="w-full">반려</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LeaveRequestList;
