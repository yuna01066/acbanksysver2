import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ScrollTimePicker from '@/components/ui/scroll-time-picker';

interface AttendanceRecord {
  id: string;
  user_name: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  memo: string | null;
}

interface Props {
  record: AttendanceRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const AttendanceEditDialog: React.FC<Props> = ({ record, open, onOpenChange, onSaved }) => {
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [status, setStatus] = useState('present');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (record) {
      setCheckInTime(record.check_in ? format(new Date(record.check_in), 'HH:mm') : '');
      setCheckOutTime(record.check_out ? format(new Date(record.check_out), 'HH:mm') : '');
      setStatus(record.status || 'present');
      setMemo(record.memo || '');
    }
  }, [record]);

  const handleSave = async () => {
    if (!record) return;
    setSaving(true);
    try {
      const dateStr = record.date;
      const checkIn = checkInTime ? new Date(`${dateStr}T${checkInTime}:00+09:00`).toISOString() : null;
      const checkOut = checkOutTime ? new Date(`${dateStr}T${checkOutTime}:00+09:00`).toISOString() : null;

      const updateData: any = {
        check_in: checkIn,
        check_out: checkOut,
        status,
        memo: memo || null,
      };

      const { error } = await supabase
        .from('attendance_records')
        .update(updateData)
        .eq('id', record.id);

      if (error) throw error;
      toast.success('근태 기록이 수정되었습니다.');
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error('수정 실패: ' + (e.message || ''));
    } finally {
      setSaving(false);
    }
  };

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>근태 기록 수정</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">직원명</Label>
              <Input value={record.user_name} disabled className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">날짜</Label>
              <Input value={record.date} disabled className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">출근 시간</Label>
              <ScrollTimePicker
                value={checkInTime}
                onChange={setCheckInTime}
                className="mt-1 w-full h-9 text-sm"
                placeholder="출근 시간"
              />
            </div>
            <div>
              <Label className="text-sm">퇴근 시간</Label>
              <ScrollTimePicker
                value={checkOutTime}
                onChange={setCheckOutTime}
                className="mt-1 w-full h-9 text-sm"
                placeholder="퇴근 시간"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm">상태</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="present">근무 중</SelectItem>
                <SelectItem value="checked_in">근무 중</SelectItem>
                <SelectItem value="checked_out">퇴근 완료</SelectItem>
                <SelectItem value="absent">결근</SelectItem>
                <SelectItem value="late">지각</SelectItem>
                <SelectItem value="early_leave">조퇴</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm">메모</Label>
            <Textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="수정 사유 등을 입력하세요"
              className="mt-1"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              저장
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AttendanceEditDialog;
