import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Building2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns';
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

  const businessDays = useMemo(() => {
    const days = eachDayOfInterval({ start: startOfMonth(targetDate), end: endOfMonth(targetDate) });
    return days.filter(d => !isWeekend(d)).length;
  }, [year, month]);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['dept-pattern-records', startDate, endDate],
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
    queryKey: ['dept-pattern-employees'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, department')
        .eq('is_approved', true);
      return data || [];
    },
  });

  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['dept-pattern-leaves', startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('leave_requests')
        .select('user_id, days')
        .eq('status', 'approved')
        .gte('start_date', startDate)
        .lte('end_date', endDate);
      return data || [];
    },
  });

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
      const lateCount = deptRecords.filter(r => {
        if (!r.check_in) return false;
        const d = new Date(r.check_in);
        return d.getHours() > 9 || (d.getHours() === 9 && d.getMinutes() > 30);
      }).length;

      // Leave days
      const leaveDays = leaveRequests
        .filter(l => deptIds.has(l.user_id))
        .reduce((s, l) => s + (l.days || 0), 0);

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
  }, [departments, employees, records, leaveRequests, businessDays]);

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

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
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
