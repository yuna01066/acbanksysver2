import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Clock, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import AttendanceEditDialog from '@/components/attendance/AttendanceEditDialog';
import { useQueryClient } from '@tanstack/react-query';

interface AttendanceRecord {
  id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  work_hours: number | null;
  memo: string | null;
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
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editRecord, setEditRecord] = useState<any>(null);

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

  useEffect(() => {
    fetchRecords();
  }, [userId, currentMonth]);

  const prevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

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
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-sm font-semibold">
            {format(currentMonth, 'yyyy년 M월', { locale: ko })}
          </h3>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
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
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
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
                {isAdmin && <th className="px-3 py-2 text-center font-medium w-16">수정</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {records.map(r => {
                const st = statusMap[r.status] || { label: r.status, variant: 'outline' as const };
                return (
                  <tr key={r.id} className="hover:bg-accent/30">
                    <td className="px-3 py-2 font-medium">
                      {format(new Date(r.date), 'M/d (EEE)', { locale: ko })}
                    </td>
                    <td className="px-3 py-2">{formatTime(r.check_in)}</td>
                    <td className="px-3 py-2">{formatTime(r.check_out)}</td>
                    <td className="px-3 py-2">{r.work_hours ? `${r.work_hours.toFixed(1)}h` : '-'}</td>
                    <td className="px-3 py-2">
                      <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs truncate max-w-[120px]">{r.memo || ''}</td>
                    {isAdmin && (
                      <td className="px-3 py-2 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setEditRecord({ ...r, user_name: userName })}
                        >
                          <CalendarDays className="h-3 w-3" />
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

      {editRecord && (
        <AttendanceEditDialog
          record={editRecord}
          open={!!editRecord}
          onOpenChange={(open) => !open && setEditRecord(null)}
          onSaved={() => {
            setEditRecord(null);
            fetchRecords();
          }}
        />
      )}
    </div>
  );
};

export default EmployeeAttendancePanel;
