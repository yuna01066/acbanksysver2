import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Clock, CalendarDays, ChevronLeft, ChevronRight, Plus, Pencil } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import ScrollTimePicker from '@/components/ui/scroll-time-picker';

interface AttendanceRecord {
  id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  work_hours: number | null;
  memo: string | null;
  user_name?: string;
}

interface Props {
  userId: string;
  userName: string;
}

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  checked_in: { label: '근무중', variant: 'default' },
  checked_out: { label: '퇴근', variant: 'secondary' },
  absent: { label: '결근', variant: 'destructive' },
  late: { label: '지각', variant: 'outline' },
  half_day: { label: '반차', variant: 'outline' },
  holiday: { label: '휴일', variant: 'secondary' },
};

const EmployeeAttendancePanel: React.FC<Props> = ({ userId, userName }) => {
  const { isAdmin, isModerator } = useAuth();
  const queryClient = useQueryClient();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Edit form state
  const [formDate, setFormDate] = useState('');
  const [formCheckIn, setFormCheckIn] = useState('');
  const [formCheckOut, setFormCheckOut] = useState('');
  const [formStatus, setFormStatus] = useState('checked_in');
  const [formMemo, setFormMemo] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  const canEdit = isAdmin || isModerator;

  const fetchRecords = async () => {
    setLoading(true);
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    const { data, error } = await supabase
      .from('attendance_records')
      .select('id, date, check_in, check_out, status, work_hours, memo')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true });

    if (!error && data) setRecords(data);
    setLoading(false);
  };

  useEffect(() => { fetchRecords(); }, [userId, currentMonth]);

  const openAddDialog = () => {
    setIsAdding(true);
    setEditRecord(null);
    setFormDate(format(new Date(), 'yyyy-MM-dd'));
    setFormCheckIn('09:00');
    setFormCheckOut('');
    setFormStatus('checked_in');
    setFormMemo('');
    setEditDialogOpen(true);
  };

  const openEditDialog = (r: AttendanceRecord) => {
    setIsAdding(false);
    setEditRecord(r);
    setFormDate(r.date);
    setFormCheckIn(r.check_in ? format(new Date(r.check_in), 'HH:mm') : '');
    setFormCheckOut(r.check_out ? format(new Date(r.check_out), 'HH:mm') : '');
    setFormStatus(r.status || 'checked_in');
    setFormMemo(r.memo || '');
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    setFormSaving(true);
    try {
      const checkIn = formCheckIn ? new Date(`${formDate}T${formCheckIn}:00+09:00`).toISOString() : null;
      const checkOut = formCheckOut ? new Date(`${formDate}T${formCheckOut}:00+09:00`).toISOString() : null;

      if (isAdding) {
        const { error } = await supabase.from('attendance_records').insert({
          user_id: userId,
          user_name: userName,
          date: formDate,
          check_in: checkIn,
          check_out: checkOut,
          status: formCheckOut ? 'checked_out' : formStatus,
          memo: formMemo || null,
        });
        if (error) throw error;
        toast.success('근태 기록이 추가되었습니다.');
      } else if (editRecord) {
        const { error } = await supabase.from('attendance_records').update({
          check_in: checkIn,
          check_out: checkOut,
          status: formCheckOut ? 'checked_out' : formStatus,
          memo: formMemo || null,
        }).eq('id', editRecord.id);
        if (error) throw error;
        toast.success('근태 기록이 수정되었습니다.');
      }
      setEditDialogOpen(false);
      fetchRecords();
      queryClient.invalidateQueries({ queryKey: ['attendance-monthly'] });
    } catch (e: any) {
      toast.error('저장 실패: ' + (e.message || ''));
    } finally {
      setFormSaving(false);
    }
  };

  const formatTime = (isoStr: string | null) => {
    if (!isoStr) return '-';
    return format(new Date(isoStr), 'HH:mm');
  };

  const totalWorkDays = records.filter(r => r.status === 'checked_out' || r.status === 'checked_in').length;
  const totalWorkHours = records.reduce((sum, r) => sum + (r.work_hours || 0), 0);
  const absentDays = records.filter(r => r.status === 'absent').length;
  const lateDays = records.filter(r => r.status === 'late').length;

  return (
    <div className="py-4 space-y-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-sm font-semibold">{format(currentMonth, 'yyyy년 M월', { locale: ko })}</h3>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={openAddDialog}>
            <Plus className="h-3.5 w-3.5" /> 수동 추가
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">출근일</p>
          <p className="text-lg font-bold">{totalWorkDays}일</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">총 근무시간</p>
          <p className="text-lg font-bold">{totalWorkHours.toFixed(1)}h</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">결근</p>
          <p className="text-lg font-bold text-destructive">{absentDays}일</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">지각</p>
          <p className="text-lg font-bold">{lateDays}일</p>
        </div>
      </div>

      {/* Records Table */}
      {loading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : records.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-20" />
          해당 월의 출퇴근 기록이 없습니다.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">날짜</th>
                <th className="px-3 py-2 text-left font-medium">출근</th>
                <th className="px-3 py-2 text-left font-medium">퇴근</th>
                <th className="px-3 py-2 text-left font-medium">근무시간</th>
                <th className="px-3 py-2 text-left font-medium">상태</th>
                <th className="px-3 py-2 text-left font-medium">비고</th>
                {canEdit && <th className="px-3 py-2 text-center font-medium w-16">수정</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {records.map(r => {
                const st = statusMap[r.status] || { label: r.status, variant: 'outline' as const };
                return (
                  <tr key={r.id} className="hover:bg-accent/30">
                    <td className="px-3 py-2 font-medium">{format(new Date(r.date), 'M/d (EEE)', { locale: ko })}</td>
                    <td className="px-3 py-2">{formatTime(r.check_in)}</td>
                    <td className="px-3 py-2">{formatTime(r.check_out)}</td>
                    <td className="px-3 py-2">{r.work_hours ? `${r.work_hours.toFixed(1)}h` : '-'}</td>
                    <td className="px-3 py-2"><Badge variant={st.variant} className="text-[10px]">{st.label}</Badge></td>
                    <td className="px-3 py-2 text-muted-foreground text-xs truncate max-w-[120px]">{r.memo || ''}</td>
                    {canEdit && (
                      <td className="px-3 py-2 text-center">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openEditDialog(r)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isAdding ? '근태 기록 추가' : '근태 기록 수정'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">직원명</Label>
                <Input value={userName} disabled className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">날짜</Label>
                <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} disabled={!isAdding} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">출근 시간</Label>
                <ScrollTimePicker value={formCheckIn} onChange={setFormCheckIn} className="mt-1 w-full h-9 text-sm" placeholder="출근 시간" />
              </div>
              <div>
                <Label className="text-sm">퇴근 시간</Label>
                <ScrollTimePicker value={formCheckOut} onChange={setFormCheckOut} className="mt-1 w-full h-9 text-sm" placeholder="퇴근 시간" />
              </div>
            </div>
            <div>
              <Label className="text-sm">상태</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
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
              <Textarea value={formMemo} onChange={(e) => setFormMemo(e.target.value)} placeholder="사유 등을 입력하세요" className="mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>취소</Button>
              <Button onClick={handleSave} disabled={formSaving}>
                {formSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {isAdding ? '추가' : '저장'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeAttendancePanel;
