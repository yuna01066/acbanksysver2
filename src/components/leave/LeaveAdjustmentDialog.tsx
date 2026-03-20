import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface LeaveAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: { id: string; full_name: string } | null;
  onSuccess: () => void;
}

const LEAVE_CATEGORIES = [
  { value: 'annual', label: '연차' },
  { value: 'monthly', label: '월차' },
  { value: 'special', label: '특별휴가' },
  { value: 'reward', label: '포상 휴가' },
  { value: 'other', label: '기타' },
];

const LeaveAdjustmentDialog: React.FC<LeaveAdjustmentDialogProps> = ({
  open, onOpenChange, employee, onSuccess,
}) => {
  const { user, profile } = useAuth();
  const [adjustmentType, setAdjustmentType] = useState<'grant' | 'deduct'>('grant');
  const [days, setDays] = useState('');
  const [category, setCategory] = useState('annual');
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState<Date>(new Date());
  const [expiresAt, setExpiresAt] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!employee || !user || !profile) return;
    const numDays = parseFloat(days);
    if (isNaN(numDays) || numDays <= 0) {
      toast.error('유효한 일수를 입력해주세요.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('leave_adjustments').insert({
      user_id: employee.id,
      user_name: employee.full_name,
      adjustment_type: adjustmentType,
      days: numDays,
      leave_category: category,
      reason: reason || null,
      granted_by: user.id,
      granted_by_name: profile.full_name,
      effective_date: format(effectiveDate, 'yyyy-MM-dd'),
      expires_at: expiresAt ? format(expiresAt, 'yyyy-MM-dd') : null,
    });

    setSaving(false);
    if (error) {
      toast.error('저장 실패: ' + error.message);
      return;
    }

    toast.success(`${employee.full_name}님에게 ${numDays}일 ${adjustmentType === 'grant' ? '부여' : '차감'}되었습니다.`);
    // Notify the employee
    await supabase.from('notifications').insert({
      user_id: employee.id,
      type: 'leave_adjustment',
      title: adjustmentType === 'grant' ? '연차 추가 부여' : '연차 차감',
      description: `${LEAVE_CATEGORIES.find(c => c.value === category)?.label || category} ${numDays}일이 ${adjustmentType === 'grant' ? '추가 부여' : '차감'}되었습니다.${reason ? ` 사유: ${reason}` : ''}`,
      data: { adjustment_type: adjustmentType, days: numDays, category },
    });

    resetForm();
    onOpenChange(false);
    onSuccess();
  };

  const resetForm = () => {
    setDays('');
    setCategory('annual');
    setReason('');
    setAdjustmentType('grant');
    setEffectiveDate(new Date());
    setExpiresAt(undefined);
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {adjustmentType === 'grant' ? <Plus className="h-5 w-5 text-emerald-600" /> : <Minus className="h-5 w-5 text-destructive" />}
            {employee.full_name} - 연차 {adjustmentType === 'grant' ? '추가 부여' : '차감'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Type toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={adjustmentType === 'grant' ? 'default' : 'outline'}
              className={cn("flex-1", adjustmentType === 'grant' && "bg-emerald-600 hover:bg-emerald-700")}
              onClick={() => setAdjustmentType('grant')}
            >
              <Plus className="h-4 w-4 mr-1" /> 부여
            </Button>
            <Button
              type="button"
              variant={adjustmentType === 'deduct' ? 'destructive' : 'outline'}
              className="flex-1"
              onClick={() => setAdjustmentType('deduct')}
            >
              <Minus className="h-4 w-4 mr-1" /> 차감
            </Button>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-sm">휴가 종류</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAVE_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Days */}
          <div className="space-y-1.5">
            <Label className="text-sm">{adjustmentType === 'grant' ? '부여' : '차감'} 일수</Label>
            <Input
              type="number"
              step="0.5"
              min="0.5"
              placeholder="예: 3"
              value={days}
              onChange={e => setDays(e.target.value)}
            />
          </div>

          {/* Effective date */}
          <div className="space-y-1.5">
            <Label className="text-sm">적용일</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(effectiveDate, 'yyyy-MM-dd')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={effectiveDate}
                  onSelect={d => d && setEffectiveDate(d)}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Expiration (optional) */}
          <div className="space-y-1.5">
            <Label className="text-sm">만료일 (선택)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !expiresAt && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expiresAt ? format(expiresAt, 'yyyy-MM-dd') : '만료일 없음'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expiresAt}
                  onSelect={setExpiresAt}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {expiresAt && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setExpiresAt(undefined)}>
                만료일 제거
              </Button>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label className="text-sm">사유</Label>
            <Textarea
              placeholder="추가 부여 사유를 입력해주세요"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !days}
            className={adjustmentType === 'grant' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            variant={adjustmentType === 'deduct' ? 'destructive' : 'default'}
          >
            {saving ? '처리 중...' : adjustmentType === 'grant' ? '부여하기' : '차감하기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LeaveAdjustmentDialog;
