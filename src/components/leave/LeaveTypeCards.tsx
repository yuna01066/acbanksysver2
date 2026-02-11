import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CalendarDays, Heart, Baby, Gem, Users, Sparkles, AlertTriangle, Sun, Mail, MoreHorizontal } from 'lucide-react';
import { calculateBusinessDays } from '@/hooks/useLeaveRequests';
import type { LeavePolicy } from '@/hooks/useLeavePolicy';

export interface LeaveTypeConfig {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  isHalf?: boolean;
}

export const EXTENDED_LEAVE_TYPES: LeaveTypeConfig[] = [
  { key: 'annual', label: '연차', description: '1일', icon: CalendarDays },
  { key: 'family_care', label: '가족돌봄', description: '신청 시 1일 부여', icon: Heart },
  { key: 'infertility', label: '난임 치료', description: '매년 6일 부여', icon: Baby },
  { key: 'marriage_self', label: '결혼 - 본인', description: '신청 시 2일 부여', icon: Gem },
  { key: 'marriage_child', label: '결혼 - 자녀', description: '신청 시 1일 부여', icon: Gem },
  { key: 'refresh', label: '리프레시', description: '3년 근속 시 30일 부여', icon: Sparkles },
  { key: 'emergency', label: '비상', description: '신청 시 1일 부여', icon: AlertTriangle },
  { key: 'summer', label: '여름(바캉스)', description: '매년 3일 부여', icon: Sun },
  { key: 'condolence_close', label: '조의 - 부모/배우자/자녀', description: '신청 시 5일 부여', icon: Mail },
  { key: 'condolence_extended', label: '조의 - 조부모/형제/자매', description: '신청 시 3일 부여', icon: Mail },
  { key: 'half_am', label: '오전 반차', description: '0.5일', icon: CalendarDays, isHalf: true },
  { key: 'half_pm', label: '오후 반차', description: '0.5일', icon: CalendarDays, isHalf: true },
  { key: 'sick', label: '병가', description: '신청 시 부여', icon: AlertTriangle },
  { key: 'unpaid', label: '무급휴가', description: '신청 시 부여', icon: CalendarDays },
];

interface LeaveTypeCardsProps {
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

const LeaveTypeCards: React.FC<LeaveTypeCardsProps> = ({ onSubmit, remainingDays, leavePolicy, canRequest }) => {
  const [selectedType, setSelectedType] = useState<LeaveTypeConfig | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isHalf = selectedType?.isHalf || false;

  const calculatedDays = (() => {
    if (!startDate) return 0;
    if (isHalf) return 0.5;
    if (!endDate) return 0;
    return calculateBusinessDays(startDate, endDate);
  })();

  const exceedsBalance = calculatedDays > remainingDays;
  const isBlocked = exceedsBalance && !leavePolicy.allow_advance_use;

  const handleSubmit = async () => {
    if (!selectedType || !startDate) return;
    const finalEnd = isHalf ? startDate : endDate;
    if (!finalEnd) return;

    setSubmitting(true);
    const success = await onSubmit({
      leave_type: selectedType.key,
      start_date: startDate,
      end_date: finalEnd,
      days: calculatedDays,
      reason: reason || undefined,
    });
    setSubmitting(false);
    if (success) {
      setSelectedType(null);
      setStartDate('');
      setEndDate('');
      setReason('');
    }
  };

  const handleClose = () => {
    setSelectedType(null);
    setStartDate('');
    setEndDate('');
    setReason('');
  };

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold mb-4">휴가 등록</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {EXTENDED_LEAVE_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <Card
                key={type.key}
                className="p-4 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group relative"
                onClick={() => setSelectedType(type)}
              >
                <div className="flex flex-col gap-3">
                  <Icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  <div>
                    <p className="text-sm font-medium">{type.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={!!selectedType} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedType?.label} 신청</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
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
                사용 일수: <span className="font-bold text-primary">{calculatedDays}일</span>
                <span className="text-muted-foreground ml-2">(잔여: {remainingDays}일)</span>
                {exceedsBalance && !leavePolicy.allow_advance_use && (
                  <p className="text-destructive text-xs mt-1">⚠️ 잔여 연차를 초과합니다.</p>
                )}
                {exceedsBalance && leavePolicy.allow_advance_use && (
                  <p className="text-blue-600 dark:text-blue-400 text-xs mt-1">ℹ️ 당겨쓰기가 허용되어 신청 가능합니다.</p>
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
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              신청하기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LeaveTypeCards;
