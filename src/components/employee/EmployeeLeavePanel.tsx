import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { type LeaveRequest, LEAVE_TYPES, useLeaveRequests } from '@/hooks/useLeaveRequests';
import LeaveRequestList from '@/components/leave/LeaveRequestList';

interface Props {
  userId: string;
}

const BALANCE_LEAVE_TYPES = new Set(['annual', 'monthly', 'half_am', 'half_pm']);

const isAnnualBalanceRequest = (request: LeaveRequest) => BALANCE_LEAVE_TYPES.has(request.leave_type);

const EmployeeLeavePanel: React.FC<Props> = ({ userId }) => {
  const { isAdmin, isModerator, user } = useAuth();
  const canManage = isAdmin || isModerator;
  const {
    requests, cancellations, loading, approveRequest, rejectRequest, cancelRequest,
    reviewCancellation, adminCancelRequest, adminCreateRequest,
  } = useLeaveRequests();
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [recordScope, setRecordScope] = useState<'used' | 'all'>('used');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [form, setForm] = useState({
    leaveType: 'annual', startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'), reason: '',
  });

  const employeeRequests = useMemo(() => requests.filter(request =>
    request.user_id === userId && new Date(request.start_date).getFullYear() === currentYear,
  ), [requests, userId, currentYear]);
  const usedAnnualRequests = employeeRequests.filter(request =>
    request.status === 'approved' && isAnnualBalanceRequest(request),
  );
  const visibleRequests = recordScope === 'used' ? usedAnnualRequests : employeeRequests;
  const totalUsed = usedAnnualRequests
    .reduce((sum, request) => sum + Number(request.days), 0);
  const totalPending = employeeRequests.filter(request =>
    request.status === 'pending' && isAnnualBalanceRequest(request),
  )
    .reduce((sum, request) => sum + Number(request.days), 0);

  const handleAddLeave = async () => {
    if (!form.startDate || !form.endDate) return;
    setFormSaving(true);
    const isHalf = form.leaveType === 'half_am' || form.leaveType === 'half_pm';
    const ok = await adminCreateRequest({
      user_id: userId,
      leave_type: form.leaveType,
      start_date: form.startDate,
      end_date: isHalf ? form.startDate : form.endDate,
      reason: form.reason,
    });
    setFormSaving(false);
    if (ok) setAddDialogOpen(false);
  };

  return (
    <div className="py-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" onClick={() => setCurrentYear(year => year - 1)} aria-label="이전 연도">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-sm font-semibold tabular-nums">{currentYear}년</h3>
          <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" onClick={() => setCurrentYear(year => year + 1)} aria-label="다음 연도">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {canManage && (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> 수동 등록
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          ['사용 반영', `${totalUsed}일`],
          ['승인 대기', `${totalPending}일`],
          ['전체 신청', `${employeeRequests.length}건`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3" aria-labelledby="employee-leave-history-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 id="employee-leave-history-heading" className="text-sm font-semibold">연차·휴가 기록</h3>
            <p className="mt-1 text-xs text-muted-foreground">승인된 연차·월차·반차는 사용량과 잔여 연차에 반영됩니다.</p>
          </div>
          <div className="flex w-fit rounded-md bg-muted p-1" role="group" aria-label="기록 표시 범위">
            <Button
              type="button"
              variant={recordScope === 'used' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-10 px-3 text-xs sm:h-8"
              aria-pressed={recordScope === 'used'}
              onClick={() => setRecordScope('used')}
            >
              사용 기록 <span className="ml-1 tabular-nums text-muted-foreground">{usedAnnualRequests.length}</span>
            </Button>
            <Button
              type="button"
              variant={recordScope === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-10 px-3 text-xs sm:h-8"
              aria-pressed={recordScope === 'all'}
              onClick={() => setRecordScope('all')}
            >
              전체 신청 <span className="ml-1 tabular-nums text-muted-foreground">{employeeRequests.length}</span>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8" role="status">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            <span className="sr-only">연차 기록을 불러오는 중</span>
          </div>
        ) : visibleRequests.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-20" aria-hidden="true" />
            {recordScope === 'used'
              ? '해당 연도의 승인·사용 반영 기록이 없습니다.'
              : '해당 연도의 휴가 신청 내역이 없습니다.'}
          </div>
        ) : (
          <LeaveRequestList
            requests={visibleRequests}
            cancellations={cancellations}
            isAdmin={canManage}
            currentUserId={user?.id || ''}
            onApprove={approveRequest}
            onReject={rejectRequest}
            onCancel={cancelRequest}
            onReviewCancellation={reviewCancellation}
            onAdminCancel={adminCancelRequest}
          />
        )}
      </section>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>휴가 수동 등록</DialogTitle></DialogHeader>
          <div className="mt-2 space-y-4">
            <div>
              <Label>휴가 유형</Label>
              <Select value={form.leaveType} onValueChange={leaveType => setForm(current => ({ ...current, leaveType }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAVE_TYPES).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>시작일</Label>
                <Input type="date" className="mt-1" value={form.startDate} onChange={event => setForm(current => ({ ...current, startDate: event.target.value }))} />
              </div>
              <div>
                <Label>종료일</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={form.leaveType === 'half_am' || form.leaveType === 'half_pm' ? form.startDate : form.endDate}
                  disabled={form.leaveType === 'half_am' || form.leaveType === 'half_pm'}
                  onChange={event => setForm(current => ({ ...current, endDate: event.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>사유 (선택)</Label>
              <Textarea className="mt-1" value={form.reason} onChange={event => setForm(current => ({ ...current, reason: event.target.value }))} />
            </div>
            <p className="text-xs text-muted-foreground">수동 등록 휴가는 즉시 승인되며, 이후 변경은 취소 기록으로 남습니다.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>닫기</Button>
              <Button onClick={handleAddLeave} disabled={formSaving || !form.startDate || !form.endDate}>
                {formSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}등록
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeLeavePanel;
