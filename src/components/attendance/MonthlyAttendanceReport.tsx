import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Download, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, getDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const MonthlyAttendanceReport: React.FC = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const targetDate = new Date(year, month - 1, 1);
  const startDate = format(startOfMonth(targetDate), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(targetDate), 'yyyy-MM-dd');

  // Business days in month (Mon-Fri)
  const businessDays = useMemo(() => {
    const days = eachDayOfInterval({ start: startOfMonth(targetDate), end: endOfMonth(targetDate) });
    return days.filter(d => !isWeekend(d)).length;
  }, [year, month]);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['monthly-report-records', startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance_records')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);
      return data || [];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['monthly-report-employees'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, department')
        .eq('is_approved', true);
      return data || [];
    },
  });

  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['monthly-report-leaves', startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('status', 'approved')
        .gte('start_date', startDate)
        .lte('end_date', endDate);
      return data || [];
    },
  });

  // Per-employee stats
  const employeeStats = useMemo(() => {
    return employees.map(emp => {
      const empRecords = records.filter(r => r.user_id === emp.id);
      const completedRecords = empRecords.filter(r => r.check_in && r.check_out);
      const totalHours = completedRecords.reduce((sum, r) => sum + Number(r.work_hours || 0), 0);
      const workDays = completedRecords.length;
      const avgHours = workDays > 0 ? totalHours / workDays : 0;
      const overtimeDays = completedRecords.filter(r => Number(r.work_hours || 0) > 9).length;
      const lateDays = empRecords.filter(r => {
        if (!r.check_in) return false;
        const d = new Date(r.check_in);
        return d.getHours() > 9 || (d.getHours() === 9 && d.getMinutes() > 30);
      }).length;
      const leaveDays = leaveRequests
        .filter(l => l.user_id === emp.id)
        .reduce((sum, l) => sum + (l.days || 0), 0);
      const attendanceRate = businessDays > 0 ? ((workDays + leaveDays) / businessDays * 100) : 0;

      return {
        id: emp.id,
        name: emp.full_name,
        department: emp.department || '미지정',
        workDays,
        totalHours: Math.round(totalHours * 10) / 10,
        avgHours: Math.round(avgHours * 10) / 10,
        overtimeDays,
        lateDays,
        leaveDays,
        attendanceRate: Math.min(Math.round(attendanceRate), 100),
      };
    }).sort((a, b) => b.totalHours - a.totalHours);
  }, [employees, records, leaveRequests, businessDays]);

  // Summary
  const summary = useMemo(() => {
    const totalEmployees = employeeStats.length;
    const avgAttendanceRate = totalEmployees > 0
      ? Math.round(employeeStats.reduce((s, e) => s + e.attendanceRate, 0) / totalEmployees)
      : 0;
    const totalOvertimeDays = employeeStats.reduce((s, e) => s + e.overtimeDays, 0);
    const totalLateDays = employeeStats.reduce((s, e) => s + e.lateDays, 0);
    const avgWorkHours = totalEmployees > 0
      ? Math.round(employeeStats.reduce((s, e) => s + e.avgHours, 0) / totalEmployees * 10) / 10
      : 0;
    return { totalEmployees, avgAttendanceRate, totalOvertimeDays, totalLateDays, avgWorkHours, businessDays };
  }, [employeeStats, businessDays]);

  // Chart data: daily attendance count
  const dailyChartData = useMemo(() => {
    const days = eachDayOfInterval({ start: startOfMonth(targetDate), end: endOfMonth(targetDate) });
    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayRecords = records.filter(r => r.date === dateStr);
      const isWknd = isWeekend(day);
      return {
        date: format(day, 'd'),
        출근: dayRecords.length,
        isWeekend: isWknd,
      };
    });
  }, [records, year, month]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <FileText className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold">월별 근태 리포트</h3>
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
              <SelectItem key={y} value={String(y)}>{y}년</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
          <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <SelectItem key={m} value={String(m)}>{m}월</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: '영업일수', value: `${summary.businessDays}일`, icon: '📅' },
          { label: '평균 출근율', value: `${summary.avgAttendanceRate}%`, icon: '📊' },
          { label: '평균 근무시간', value: `${summary.avgWorkHours}h`, icon: '⏱️' },
          { label: '초과근무 건수', value: `${summary.totalOvertimeDays}건`, icon: '🔴' },
          { label: '지각 건수', value: `${summary.totalLateDays}건`, icon: '⚠️' },
          { label: '대상 인원', value: `${summary.totalEmployees}명`, icon: '👥' },
        ].map(item => (
          <Card key={item.label} className="glass-card">
            <CardContent className="p-3 text-center">
              <span className="text-lg">{item.icon}</span>
              <p className="text-lg font-bold mt-1">{item.value}</p>
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily attendance chart */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <h4 className="text-xs font-semibold mb-3">일별 출근 현황</h4>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(value: number) => [`${value}명`, '출근']}
                />
                <Bar dataKey="출근" radius={[2, 2, 0, 0]}>
                  {dailyChartData.map((entry, index) => (
                    <Cell key={index} fill={entry.isWeekend ? 'hsl(var(--muted-foreground) / 0.2)' : 'hsl(var(--primary))'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Employee detail table */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold">구성원별 상세</h4>
            <span className="text-[10px] text-muted-foreground">{format(targetDate, 'yyyy년 M월', { locale: ko })}</span>
          </div>
          <div className="overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">이름</TableHead>
                  <TableHead className="text-xs">부서</TableHead>
                  <TableHead className="text-xs text-center">출근일</TableHead>
                  <TableHead className="text-xs text-center">총 근무(h)</TableHead>
                  <TableHead className="text-xs text-center">일평균(h)</TableHead>
                  <TableHead className="text-xs text-center">초과근무</TableHead>
                  <TableHead className="text-xs text-center">지각</TableHead>
                  <TableHead className="text-xs text-center">휴가</TableHead>
                  <TableHead className="text-xs text-center">출근율</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeStats.map(emp => (
                  <TableRow key={emp.id}>
                    <TableCell className="text-xs font-medium">{emp.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{emp.department}</TableCell>
                    <TableCell className="text-xs text-center">{emp.workDays}일</TableCell>
                    <TableCell className="text-xs text-center">{emp.totalHours}h</TableCell>
                    <TableCell className="text-xs text-center">{emp.avgHours}h</TableCell>
                    <TableCell className="text-xs text-center">
                      {emp.overtimeDays > 0 ? (
                        <Badge variant="destructive" className="text-[10px] px-1.5">{emp.overtimeDays}일</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-center">
                      {emp.lateDays > 0 ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 border-amber-400 text-amber-600">{emp.lateDays}일</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-center">{emp.leaveDays > 0 ? `${emp.leaveDays}일` : '-'}</TableCell>
                    <TableCell className="text-xs text-center">
                      <span className={emp.attendanceRate >= 90 ? 'text-emerald-600' : emp.attendanceRate >= 70 ? 'text-amber-600' : 'text-destructive'}>
                        {emp.attendanceRate}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonthlyAttendanceReport;
