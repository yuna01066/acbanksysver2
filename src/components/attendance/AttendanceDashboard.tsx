import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Clock, AlertTriangle, UserX, Timer, Coffee, AlarmClock, CalendarOff, Palmtree, ClipboardCheck, FileWarning, Info } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type DateRange = 'day' | 'week' | 'month';

const AttendanceDashboard: React.FC = () => {
  const [rangeType, setRangeType] = useState<DateRange>('week');
  const [departmentFilter, setDepartmentFilter] = useState('_all');

  const { startDate, endDate, rangeLabel } = useMemo(() => {
    const now = new Date();
    let s: Date, e: Date, label: string;
    switch (rangeType) {
      case 'day':
        s = now; e = now;
        label = format(now, 'yyyy. M. d (EEE)', { locale: ko });
        break;
      case 'week':
        s = startOfWeek(now, { weekStartsOn: 1 });
        e = endOfWeek(now, { weekStartsOn: 1 });
        label = `${format(s, 'yyyy. M. d', { locale: ko })} ~ ${format(e, 'M. d', { locale: ko })}`;
        break;
      case 'month':
      default:
        s = startOfMonth(now);
        e = endOfMonth(now);
        label = format(now, 'yyyy년 M월', { locale: ko });
        break;
    }
    return { startDate: format(s, 'yyyy-MM-dd'), endDate: format(e, 'yyyy-MM-dd'), rangeLabel: label };
  }, [rangeType]);

  // Fetch attendance records for the period
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['attendance-dashboard', startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance_records')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);
      return data || [];
    },
  });

  // Fetch leave requests for the period
  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['leave-dashboard', startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('leave_requests')
        .select('*')
        .gte('start_date', startDate)
        .lte('end_date', endDate);
      return data || [];
    },
  });

  // Fetch all approved employees
  const { data: employees = [] } = useQuery({
    queryKey: ['dashboard-employees'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, department')
        .eq('is_approved', true);
      return data || [];
    },
  });

  const departments = useMemo(() => {
    const depts = new Set(employees.map(e => e.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [employees]);

  const filteredEmployeeIds = useMemo(() => {
    if (departmentFilter === '_all') return new Set(employees.map(e => e.id));
    return new Set(employees.filter(e => e.department === departmentFilter).map(e => e.id));
  }, [employees, departmentFilter]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => filteredEmployeeIds.has(r.user_id));
  }, [records, filteredEmployeeIds]);

  // Calculate stats
  const stats = useMemo(() => {
    const checkedOut = filteredRecords.filter(r => r.check_in && r.check_out);

    // Average check-in time
    let avgCheckInStr = '데이터 없음';
    let avgCheckOutStr = '데이터 없음';
    let avgWorkHoursStr = '데이터 없음';

    if (checkedOut.length > 0) {
      const checkInMinutes = checkedOut.map(r => {
        const d = new Date(r.check_in!);
        return d.getHours() * 60 + d.getMinutes();
      });
      const avgIn = Math.round(checkInMinutes.reduce((a, b) => a + b, 0) / checkInMinutes.length);
      avgCheckInStr = `${String(Math.floor(avgIn / 60)).padStart(2, '0')}:${String(avgIn % 60).padStart(2, '0')}`;

      const checkOutMinutes = checkedOut.map(r => {
        const d = new Date(r.check_out!);
        return d.getHours() * 60 + d.getMinutes();
      });
      const avgOut = Math.round(checkOutMinutes.reduce((a, b) => a + b, 0) / checkOutMinutes.length);
      avgCheckOutStr = `${String(Math.floor(avgOut / 60)).padStart(2, '0')}:${String(avgOut % 60).padStart(2, '0')}`;

      const totalHours = checkedOut.reduce((sum, r) => sum + Number(r.work_hours || 0), 0);
      const avg = totalHours / checkedOut.length;
      avgWorkHoursStr = `${avg.toFixed(1)}시간`;
    }

    // Employees with no records in period
    const employeesWithRecords = new Set(filteredRecords.map(r => r.user_id));
    const missingRecordCount = [...filteredEmployeeIds].filter(id => !employeesWithRecords.has(id)).length;

    // Overtime (>9 hours per day)
    const overtimeCount = new Set(filteredRecords.filter(r => Number(r.work_hours || 0) > 9).map(r => r.user_id)).size;

    // Under hours (<8 hours when checked out)
    const underHoursCount = new Set(
      checkedOut.filter(r => Number(r.work_hours || 0) < 8).map(r => r.user_id)
    ).size;

    // Late (check-in after 09:30)
    const lateCount = new Set(
      filteredRecords.filter(r => {
        if (!r.check_in) return false;
        const d = new Date(r.check_in);
        return d.getHours() > 9 || (d.getHours() === 9 && d.getMinutes() > 30);
      }).map(r => r.user_id)
    ).size;

    // Leave usage
    const leaveUsers = new Set(
      leaveRequests.filter(l => l.status === 'approved' && filteredEmployeeIds.has(l.user_id)).map(l => l.user_id)
    ).size;

    // Pending approvals
    const pendingApproval = leaveRequests.filter(l => l.status === 'pending' && filteredEmployeeIds.has(l.user_id)).length;

    return {
      avgCheckInStr, avgCheckOutStr, avgWorkHoursStr,
      missingRecordCount, overtimeCount, underHoursCount, lateCount, leaveUsers, pendingApproval,
    };
  }, [filteredRecords, filteredEmployeeIds, leaveRequests]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const summaryCards = [
    { icon: '🟡', label: '평균 출근', desc: '구성원 근무 기록의 평균 시작 시각', value: stats.avgCheckInStr },
    { icon: '🟠', label: '평균 퇴근', desc: '구성원 근무 기록의 평균 종료 시각', value: stats.avgCheckOutStr },
    { icon: '🟢', label: '일평균 근무', desc: '구성원 근무 기록의 평균 시간', value: stats.avgWorkHoursStr },
  ];

  const statusCards = [
    { icon: UserX, label: '근무 기록 누락', desc: '근무 또는 휴가 기록이 없는 구성원 수', count: stats.missingRecordCount },
    { icon: Timer, label: '근무 시간 초과', desc: '소정 근무 시간을 초과한 구성원 수', count: stats.overtimeCount },
    { icon: AlertTriangle, label: '근무 시간 미달', desc: '소정 근무시간을 미달한 구성원 수', count: stats.underHoursCount },
    { icon: AlarmClock, label: '지각', desc: '출근 시간을 넘겨 근무를 시작한 구성원 수', count: stats.lateCount },
    { icon: Palmtree, label: '휴가 사용', desc: '휴가 사용 기록이 있는 구성원 수', count: stats.leaveUsers },
  ];

  const approvalCards = [
    { icon: ClipboardCheck, label: '승인 대기 중', desc: '미승인 근태 기록이 있는 구성원 수', count: stats.pendingApproval },
  ];

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Date range & filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 border rounded-lg p-0.5">
            {(['day', 'week', 'month'] as DateRange[]).map(r => (
              <Button
                key={r}
                variant={rangeType === r ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-3"
                onClick={() => setRangeType(r)}
              >
                {{ day: '일', week: '주', month: '월' }[r]}
              </Button>
            ))}
          </div>
          <span className="text-sm text-muted-foreground">{rangeLabel}</span>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="부서 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">부서 전체</SelectItem>
              {departments.map(d => (
                <SelectItem key={d} value={d!}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground">
            {format(new Date(), 'yyyy. M. d (EEE) a h:mm', { locale: ko })}
          </span>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {summaryCards.map(card => (
            <Card key={card.label} className="glass-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{card.icon}</span>
                    <span className="font-semibold text-sm">{card.label}</span>
                  </div>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground/50" />
                    </TooltipTrigger>
                    <TooltipContent><p className="text-xs">{card.desc}</p></TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{card.desc}</p>
                <p className="text-lg font-bold">{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 근태 현황 */}
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            근태 현황
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {statusCards.map(card => {
              const Icon = card.icon;
              return (
                <Card key={card.label} className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{card.label}</span>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3.5 w-3.5 text-muted-foreground/50" />
                        </TooltipTrigger>
                        <TooltipContent><p className="text-xs max-w-[200px]">{card.desc}</p></TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{card.desc}</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold">{card.count}명</span>
                      <span className="text-xs text-muted-foreground">변동없음</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* 승인·증빙 */}
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            승인 · 증빙
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {approvalCards.map(card => {
              const Icon = card.icon;
              return (
                <Card key={card.label} className="glass-card">
                  <CardContent className="p-4">
                    <span className="text-sm font-medium">{card.label}</span>
                    <p className="text-xs text-muted-foreground mb-3">{card.desc}</p>
                    <span className="text-xl font-bold">{card.count}명</span>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default AttendanceDashboard;
