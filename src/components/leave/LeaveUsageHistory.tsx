import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { type LeaveRequest, LEAVE_TYPES, LEAVE_STATUS } from '@/hooks/useLeaveRequests';
import { EXTENDED_LEAVE_TYPES } from './LeaveTypeCards';

interface LeaveUsageHistoryProps {
  requests: LeaveRequest[];
  currentUserId: string;
  onCancel: (id: string) => Promise<void>;
}

const LeaveUsageHistory: React.FC<LeaveUsageHistoryProps> = ({ requests, currentUserId, onCancel }) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [includeRejected, setIncludeRejected] = useState(false);

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
      if (!includeRejected && r.status === 'rejected') return false;
      if (r.status === 'cancelled') return false;
      return true;
    });
  }, [requests, selectedYear, includeRejected]);

  const getLeaveLabel = (key: string) => {
    const ext = EXTENDED_LEAVE_TYPES.find(t => t.key === key);
    if (ext) return ext.label;
    return LEAVE_TYPES[key] || key;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">사용한 기록</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            반려 기록 포함
            <Switch checked={includeRejected} onCheckedChange={setIncludeRejected} />
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
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedYear(y => y - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedYear(y => y + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg bg-muted/30 border py-12 flex flex-col items-center justify-center text-muted-foreground">
          <Info className="h-6 w-6 mb-2" />
          <p className="text-sm">예정된 휴가가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const status = LEAVE_STATUS[req.status] || LEAVE_STATUS.pending;
            const canCancelReq = req.user_id === currentUserId && req.status === 'pending';

            return (
              <div key={req.id} className="border rounded-lg p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">{getLeaveLabel(req.leave_type)}</Badge>
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
                  {req.status === 'rejected' && req.reject_reason && (
                    <p className="text-xs text-destructive mt-1">반려 사유: {req.reject_reason}</p>
                  )}
                </div>
                {canCancelReq && (
                  <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onCancel(req.id)}>
                    취소
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LeaveUsageHistory;
