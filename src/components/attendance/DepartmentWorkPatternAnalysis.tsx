import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Building2, AlertTriangle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(220, 70%, 55%)',
  'hsl(150, 60%, 45%)',
  'hsl(35, 80%, 55%)',
  'hsl(340, 65%, 50%)',
  'hsl(270, 55%, 55%)',
];

const DepartmentWorkPatternAnalysis: React.FC = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const targetDate = new Date(year, month - 1, 1);
  const startDate = format(startOfMonth(targetDate), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(targetDate), 'yyyy-MM-dd');

  const { data: records = [], isLoading, error: recordsError } = useQuery({
    queryKey: ['dept-pattern-records', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: employees = [], error: employeesError } = useQuery<any[]>({
    queryKey: ['dept-pattern-employees'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('profile_directory' as any) as any)
        .select('id, full_name, department')
        .order('full_name');
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: leaveRequests = [], error: leaveRequestsError } = useQuery({
    queryKey: ['dept-pattern-leaves', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('user_id, leave_type, start_date, end_date')
        .eq('status', 'approved')
        .lte('start_date', endDate)
        .gte('end_date', startDate);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: holidays = [], isLoading: holidaysLoading, error: holidaysError } = useQuery({
    queryKey: ['dept-pattern-holidays', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_holidays')
        .select('start_date, end_date')
        .lte('start_date', endDate)
        .gte('end_date', startDate);
      if (error) throw error;
      return data || [];
    },
  });

  const businessDateSet = useMemo(() => {
    const holidayDates = new Set(holidays.flatMap(holiday =>
      eachDayOfInterval({ start: parseISO(holiday.start_date), end: parseISO(holiday.end_date) })
        .map(day => format(day, 'yyyy-MM-dd')),
    ));
    return new Set(eachDayOfInterval({ start: startOfMonth(targetDate), end: endOfMonth(targetDate) })
      .filter(day => !isWeekend(day) && !holidayDates.has(format(day, 'yyyy-MM-dd')))
      .map(day => format(day, 'yyyy-MM-dd')));
  }, [holidays, year, month]);
  const businessDays = businessDateSet.size;

  // Build department map
  const empDeptMap = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach(e => map.set(e.id, e.department || '미지정'));
    return map;
  }, [employees]);

  const departments = useMemo(() => {
    const depts = new Set(employees.map(e => e.department || '미지정'));
    return Array.from(depts).sort();
  }, [employees]);

  // Department stats
  const deptStats = useMemo(() => {
    return departments.map(dept => {
      const deptEmps = employees.filter(e => (e.department || '미지정') === dept);
      const deptIds = new Set(deptEmps.map(e => e.id));
      const deptRecords = records.filter(r => deptIds.has(r.user_id));
      const completed = deptRecords.filter(r => r.check_in && r.check_out);

      const totalHours = completed.reduce((s, r) => s + Number(r.work_hours || 0), 0);
      const avgHoursPerPerson = deptEmps.length > 0 && completed.length > 0
        ? totalHours / deptEmps.length / (businessDays || 1) * (businessDays || 1) / (completed.length / deptEmps.length || 1)
        : 0;

      const avgDailyHours = completed.length > 0 ? totalHours / completed.length : 0;

      // Avg check-in time (minutes from midnight)
      const checkInMinutes = completed
        .filter(r => r.check_in)
        .map(r => {
          const d = new Date(r.check_in!);
          return d.getHours() * 60 + d.getMinutes();
        });
      const avgCheckIn = checkInMinutes.length > 0
        ? Math.round(checkInMinutes.reduce((a, b) => a + b, 0) / checkInMinutes.length)
        : 0;

      // Overtime count
      const overtimeCount = completed.filter(r => Number(r.work_hours || 0) > 9).length;

      // Late count
      const lateCount = deptRecords.filter(r => r.status === 'late').length;

      // Leave days
      const attendedUserDates = new Set(completed.map(record => `${record.user_id}:${record.date}`));
      const leaveByUserDate = new Map<string, number>();
      leaveRequests.filter(leave => deptIds.has(leave.user_id)).forEach(leave => {
        const clippedStart = leave.start_date < startDate ? startDate : leave.start_date;
        const clippedEnd = leave.end_date > endDate ? endDate : leave.end_date;
        eachDayOfInterval({ start: parseISO(clippedStart), end: parseISO(clippedEnd) }).forEach(day => {
          const date = format(day, 'yyyy-MM-dd');
          const key = `${leave.user_id}:${date}`;
          if (!businessDateSet.has(date) || attendedUserDates.has(key)) return;
          const amount = ['half_am', 'half_pm'].includes(leave.leave_type) ? 0.5 : 1;
          leaveByUserDate.set(key, Math.max(leaveByUserDate.get(key) || 0, amount));
        });
      });
      const leaveDays = [...leaveByUserDate.values()].reduce((sum, days) => sum + days, 0);

      // Attendance rate
      const totalPossible = deptEmps.length * businessDays;
      const totalPresent = completed.length + leaveDays;
      const attendanceRate = totalPossible > 0 ? Math.min(Math.round(totalPresent / totalPossible * 100), 100) : 0;

      return {
        department: dept,
        memberCount: deptEmps.length,
        avgDailyHours: Math.round(avgDailyHours * 10) / 10,
        avgCheckIn: `${String(Math.floor(avgCheckIn / 60)).padStart(2, '0')}:${String(avgCheckIn % 60).padStart(2, '0')}`,
        overtimeCount,
        lateCount,
        leaveDays,
        attendanceRate,
        totalHours: Math.round(totalHours * 10) / 10,
      };
    });
  }, [departments, employees, records, leaveRequests, businessDateSet, businessDays, startDate, endDate]);

  // Chart data: department comparison bar chart
  const barChartData = useMemo(() => {
    return deptStats.map(d => ({
      name: d.department.length > 6 ? d.department.slice(0, 6) + '..' : d.department,
      '평균 근무시간': d.avgDailyHours,
      '초과근무율': d.memberCount > 0 ? Math.round(d.overtimeCount / d.memberCount * 100) / 100 : 0,
      '출근율': d.attendanceRate,
    }));
  }, [deptStats]);

  // Radar chart data
  const radarData = useMemo(() => {
    const maxValues = {
      출근율: 100,
      일평균근무: Math.max(...deptStats.map(d => d.avgDailyHours), 1),
      초과근무: Math.max(...deptStats.map(d => d.overtimeCount), 1),
      지각: Math.max(...deptStats.map(d => d.lateCount), 1),
      휴가사용: Math.max(...deptStats.map(d => d.leaveDays), 1),
    };

    return [
      { metric: '출근율', ...Object.fromEntries(deptStats.map(d => [d.department, d.attendanceRate])) },
      { metric: '일평균근무', ...Object.fromEntries(deptStats.map(d => [d.department, Math.round(d.avgDailyHours / maxValues.일평균근무 * 100)])) },
      { metric: '초과근무', ...Object.fromEntries(deptStats.map(d => [d.department, maxValues.초과근무 > 0 ? Math.round(d.overtimeCount / maxValues.초과근무 * 100) : 0])) },
      { metric: '지각', ...Object.fromEntries(deptStats.map(d => [d.department, maxValues.지각 > 0 ? Math.round((1 - d.lateCount / maxValues.지각) * 100) : 100])) },
      { metric: '휴가사용', ...Object.fromEntries(deptStats.map(d => [d.department, maxValues.휴가사용 > 0 ? Math.round(d.leaveDays / maxValues.휴가사용 * 100) : 0])) },
    ];
  }, [deptStats]);

  if (isLoading || holidaysLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const loadError = recordsError || employeesError || leaveRequestsError || holidaysError;
  if (loadError) {
    const message = loadError instanceof Error ? loadError.message : String((loadError as any)?.message || loadError);
    return (
      <Card className="border-destructive/30 bg-destructive/5 shadow-none">
        <CardContent className="flex items-start gap-3 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">부서별 근무 패턴을 불러오지 못했습니다.</p>
            <p className="mt-1 text-xs text-muted-foreground">{message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <Building2 className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold">부서별 근무 패턴 분석</h3>
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

      {/* Department cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {deptStats.map((dept, idx) => (
          <Card key={dept.department} className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-sm font-semibold">{dept.department}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{dept.memberCount}명</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-muted/50 rounded">
                  <p className="text-muted-foreground text-[10px]">평균 출근</p>
                  <p className="font-semibold">{dept.avgCheckIn}</p>
                </div>
                <div className="p-2 bg-muted/50 rounded">
                  <p className="text-muted-foreground text-[10px]">일평균 근무</p>
                  <p className="font-semibold">{dept.avgDailyHours}h</p>
                </div>
                <div className="p-2 bg-muted/50 rounded">
                  <p className="text-muted-foreground text-[10px]">초과근무</p>
                  <p className="font-semibold text-destructive">{dept.overtimeCount}건</p>
                </div>
                <div className="p-2 bg-muted/50 rounded">
                  <p className="text-muted-foreground text-[10px]">출근율</p>
                  <p className={`font-semibold ${dept.attendanceRate >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>{dept.attendanceRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar chart comparison */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <h4 className="text-xs font-semibold mb-3">부서별 평균 근무시간 비교</h4>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="평균 근무시간" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Radar chart */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <h4 className="text-xs font-semibold mb-3">부서별 근무 패턴 레이더</h4>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis tick={{ fontSize: 8 }} domain={[0, 100]} />
                  {departments.slice(0, 4).map((dept, idx) => (
                    <Radar
                      key={dept}
                      name={dept}
                      dataKey={dept}
                      stroke={COLORS[idx % COLORS.length]}
                      fill={COLORS[idx % COLORS.length]}
                      fillOpacity={0.15}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department attendance rate bar */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <h4 className="text-xs font-semibold mb-3">부서별 출근율</h4>
          <div className="space-y-3">
            {deptStats.map((dept, idx) => (
              <div key={dept.department} className="flex items-center gap-3">
                <span className="text-xs w-20 truncate">{dept.department}</span>
                <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${dept.attendanceRate}%`,
                      backgroundColor: COLORS[idx % COLORS.length],
                    }}
                  />
                </div>
                <span className="text-xs font-semibold w-12 text-right">{dept.attendanceRate}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DepartmentWorkPatternAnalysis;
