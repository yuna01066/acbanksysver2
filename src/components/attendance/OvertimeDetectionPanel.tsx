import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertTriangle, Bell, RefreshCw } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';

const OvertimeDetectionPanel: React.FC = () => {
  const [targetDate, setTargetDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const queryClient = useQueryClient();

  // Fetch records with overtime for the selected date
  const { data: overtimeRecords = [], isLoading } = useQuery({
    queryKey: ['overtime-records', targetDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance_records')
        .select('id, user_id, user_name, date, check_in, check_out, work_hours, status')
        .eq('date', targetDate)
        .eq('status', 'checked_out')
        .order('work_hours', { ascending: false });
      return (data || []).filter(r => Number(r.work_hours || 0) > 9);
    },
  });

  // Recent 7 days overtime trend
  const { data: weeklyTrend = [] } = useQuery({
    queryKey: ['overtime-weekly-trend'],
    queryFn: async () => {
      const endDate = format(new Date(), 'yyyy-MM-dd');
      const startDate = format(subDays(new Date(), 6), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('attendance_records')
        .select('date, work_hours')
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('status', 'checked_out');

      // Group by date
      const map = new Map<string, number>();
      (data || []).forEach(r => {
        if (Number(r.work_hours || 0) > 9) {
          map.set(r.date, (map.get(r.date) || 0) + 1);
        }
      });

      return Array.from({ length: 7 }, (_, i) => {
        const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
        return { date: d, label: format(new Date(d), 'M/d'), count: map.get(d) || 0 };
      });
    },
  });

  // Trigger overtime detection edge function
  const detectMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('overtime-detection', {
        body: { date: targetDate },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || '초과근무 감지 완료');
      queryClient.invalidateQueries({ queryKey: ['overtime-records'] });
    },
    onError: (err: any) => toast.error('감지 실패: ' + err.message),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h3 className="text-sm font-semibold">초과근무 자동 감지</h3>
        <Input
          type="date"
          value={targetDate}
          onChange={e => setTargetDate(e.target.value)}
          className="h-8 w-[160px] text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1"
          onClick={() => detectMutation.mutate()}
          disabled={detectMutation.isPending}
        >
          {detectMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
          감지 및 알림 발송
        </Button>
      </div>

      {/* 7-day trend */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <h4 className="text-xs font-semibold mb-3">최근 7일 초과근무 추이</h4>
          <div className="flex items-end gap-2 h-[80px]">
            {weeklyTrend.map(day => {
              const maxCount = Math.max(...weeklyTrend.map(d => d.count), 1);
              const height = day.count > 0 ? Math.max((day.count / maxCount) * 60, 8) : 4;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold">{day.count > 0 ? day.count : ''}</span>
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${height}px`,
                      backgroundColor: day.count > 0 ? 'hsl(var(--destructive))' : 'hsl(var(--muted))',
                    }}
                  />
                  <span className="text-[9px] text-muted-foreground">{day.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Overtime list */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold">
              {format(new Date(targetDate), 'M월 d일', { locale: ko })} 초과근무자
            </h4>
            <Badge variant={overtimeRecords.length > 0 ? 'destructive' : 'secondary'} className="text-[10px]">
              {overtimeRecords.length}명
            </Badge>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : overtimeRecords.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">초과근무 기록이 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">이름</TableHead>
                  <TableHead className="text-xs text-center">출근</TableHead>
                  <TableHead className="text-xs text-center">퇴근</TableHead>
                  <TableHead className="text-xs text-center">근무시간</TableHead>
                  <TableHead className="text-xs text-center">초과시간</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overtimeRecords.map(r => {
                  const hours = Number(r.work_hours || 0);
                  const overtime = hours - 8;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs font-medium">{r.user_name}</TableCell>
                      <TableCell className="text-xs text-center">
                        {r.check_in ? format(new Date(r.check_in), 'HH:mm') : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        {r.check_out ? format(new Date(r.check_out), 'HH:mm') : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-center font-semibold">{hours.toFixed(1)}h</TableCell>
                      <TableCell className="text-xs text-center">
                        <Badge variant="destructive" className="text-[10px]">+{overtime.toFixed(1)}h</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OvertimeDetectionPanel;
