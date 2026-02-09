import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Loader2 } from 'lucide-react';
import { LEAVE_TYPES, calculateBusinessDays } from '@/hooks/useLeaveRequests';
import type { LeavePolicy } from '@/hooks/useLeavePolicy';

interface LeaveRequestFormProps {
  onSubmit: (params: {
    leave_type: string;
    start_date: string;
    end_date: string;
    days: number;
    reason?: string;
  }) => Promise<boolean | undefined>;
  remainingDays: number;
  leavePolicy: LeavePolicy;
  canRequest: (requestDays: number, remainingDays: number) => boolean;
}

const LeaveRequestForm: React.FC<LeaveRequestFormProps> = ({ onSubmit, remainingDays, leavePolicy, canRequest }) => {
  const [open, setOpen] = useState(false);
  const [leaveType, setLeaveType] = useState('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isHalf = leaveType === 'half_am' || leaveType === 'half_pm';

  // Filter leave types based on policy leave_unit
  const availableLeaveTypes = useMemo(() => {
    const types = { ...LEAVE_TYPES };
    if (leavePolicy.leave_unit === 'day') {
      // Day unit: no half-day options
      delete types.half_am;
      delete types.half_pm;
    }
    // half_day and hour units keep all options
    return types;
  }, [leavePolicy.leave_unit]);

  const calculatedDays = useMemo(() => {
    if (!startDate) return 0;
    if (isHalf) return 0.5;
    if (!endDate) return 0;
    return calculateBusinessDays(startDate, endDate);
  }, [startDate, endDate, isHalf]);

  const exceedsBalance = calculatedDays > remainingDays;
  const isBlocked = exceedsBalance && !leavePolicy.allow_advance_use;

  const unitLabel = leavePolicy.leave_unit === 'hour' ? '시간' : '일';

  const handleSubmit = async () => {
    if (!startDate) return;
    const finalEnd = isHalf ? startDate : endDate;
    if (!finalEnd) return;

    setSubmitting(true);
    const success = await onSubmit({
      leave_type: leaveType,
      start_date: startDate,
      end_date: finalEnd,
      days: calculatedDays,
      reason: reason || undefined,
    });
    setSubmitting(false);
    if (success) {
      setOpen(false);
      setLeaveType('annual');
      setStartDate('');
      setEndDate('');
      setReason('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> 연차 신청
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>연차 신청</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-sm">휴가 유형</Label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(availableLeaveTypes).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">{isHalf ? '날짜' : '시작일'}</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1" />
            </div>
            {!isHalf && (
              <div>
                <Label className="text-sm">종료일</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1" min={startDate} />
              </div>
            )}
          </div>
          {calculatedDays > 0 && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              사용 일수: <span className="font-bold text-primary">{calculatedDays}{unitLabel}</span>
              <span className="text-muted-foreground ml-2">(잔여: {remainingDays}{unitLabel})</span>
              {exceedsBalance && !leavePolicy.allow_advance_use && (
                <p className="text-destructive text-xs mt-1">⚠️ 잔여 연차를 초과합니다. 당겨쓰기가 허용되지 않습니다.</p>
              )}
              {exceedsBalance && leavePolicy.allow_advance_use && (
                <p className="text-blue-600 dark:text-blue-400 text-xs mt-1">ℹ️ 잔여 연차를 초과하지만 당겨쓰기가 허용되어 신청 가능합니다.</p>
              )}
            </div>
          )}
          <div>
            <Label className="text-sm">사유 (선택)</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="mt-1 resize-none" placeholder="사유를 입력하세요..." />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !startDate || (!isHalf && !endDate) || isBlocked}
            className="w-full"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            신청하기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeaveRequestForm;
