import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users } from 'lucide-react';
import { calculateMonthlyLeaveDays, calculateAnnualOnlyDays, calculatePolicyBasedLeaveDays, LeaveRequest } from '@/hooks/useLeaveRequests';
import { differenceInMonths } from 'date-fns';

interface EmployeeProfile {
  id: string;
  full_name: string;
  join_date: string | null;
  department: string | null;
}

interface AdminLeaveOverviewProps {
  employees: EmployeeProfile[];
  allRequests: LeaveRequest[];
  grantMethod: string;
  grantBasis: string;
}

const AdminLeaveOverview: React.FC<AdminLeaveOverviewProps> = ({
  employees, allRequests, grantMethod, grantBasis,
}) => {
  const [search, setSearch] = React.useState('');

  const employeeStats = useMemo(() => {
    return employees.map(emp => {
      const joinDate = emp.join_date || '';
      const totalMonths = joinDate ? differenceInMonths(new Date(), new Date(joinDate)) : 0;
      const isUnderOneYear = totalMonths < 12;

      const monthlyDays = calculateMonthlyLeaveDays(joinDate);
      const annualDays = calculateAnnualOnlyDays(joinDate);
      const totalDays = calculatePolicyBasedLeaveDays(joinDate, grantMethod, grantBasis);

      const empRequests = allRequests.filter(r => r.user_id === emp.id && r.status === 'approved');

      const usedMonthly = empRequests
        .filter(r => r.leave_type === 'monthly')
        .reduce((s, r) => s + r.days, 0);

      const usedAnnual = empRequests
        .filter(r => r.leave_type === 'annual' || r.leave_type === 'half_am' || r.leave_type === 'half_pm')
        .reduce((s, r) => s + r.days, 0);

      const usedTotal = usedMonthly + usedAnnual;
      const pendingCount = allRequests.filter(r => r.user_id === emp.id && r.status === 'pending').length;

      return {
        ...emp,
        joinDate,
        isUnderOneYear,
        monthlyDays,
        annualDays,
        totalDays,
        usedMonthly,
        usedAnnual,
        usedTotal,
        remainingMonthly: monthlyDays - usedMonthly,
        remainingAnnual: annualDays - usedAnnual,
        remainingTotal: totalDays - usedTotal,
        pendingCount,
      };
    });
  }, [employees, allRequests, grantMethod, grantBasis]);

  const filtered = useMemo(() => {
    if (!search) return employeeStats;
    return employeeStats.filter(e =>
      e.full_name.includes(search) || (e.department || '').includes(search)
    );
  }, [employeeStats, search]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            전체 직원 연차/월차 현황
          </CardTitle>
          <Input
            placeholder="이름 또는 부서 검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-48 h-8 text-sm"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">직원명</TableHead>
                <TableHead className="text-xs">부서</TableHead>
                <TableHead className="text-xs text-center">구분</TableHead>
                <TableHead className="text-xs text-center">총 부여</TableHead>
                <TableHead className="text-xs text-center">사용</TableHead>
                <TableHead className="text-xs text-center">잔여</TableHead>
                <TableHead className="text-xs text-center">대기</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">
                    직원이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(emp => (
                  <React.Fragment key={emp.id}>
                    {/* 월차 row (1년 미만 근무자) */}
                    {emp.isUnderOneYear && (
                      <TableRow>
                        <TableCell className="text-sm font-medium" rowSpan={1}>
                          {emp.full_name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground" rowSpan={1}>
                          {emp.department || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">월차</Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">{emp.monthlyDays}</TableCell>
                        <TableCell className="text-center text-sm">{emp.usedMonthly}</TableCell>
                        <TableCell className={`text-center text-sm font-medium ${emp.remainingMonthly <= 0 ? 'text-destructive' : ''}`}>
                          {emp.remainingMonthly}
                        </TableCell>
                        <TableCell className="text-center">
                          {emp.pendingCount > 0 && (
                            <Badge variant="secondary" className="text-xs">{emp.pendingCount}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                    {/* 연차 row (1년 이상 근무자) */}
                    {!emp.isUnderOneYear && (
                      <TableRow>
                        <TableCell className="text-sm font-medium">
                          {emp.full_name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {emp.department || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">연차</Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">{emp.annualDays}</TableCell>
                        <TableCell className="text-center text-sm">{emp.usedAnnual}</TableCell>
                        <TableCell className={`text-center text-sm font-medium ${emp.remainingAnnual <= 0 ? 'text-destructive' : ''}`}>
                          {emp.remainingAnnual}
                        </TableCell>
                        <TableCell className="text-center">
                          {emp.pendingCount > 0 && (
                            <Badge variant="secondary" className="text-xs">{emp.pendingCount}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                    {/* 입사일 미등록 */}
                    {!emp.joinDate && (
                      <TableRow>
                        <TableCell className="text-sm font-medium">{emp.full_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{emp.department || '-'}</TableCell>
                        <TableCell colSpan={5} className="text-xs text-muted-foreground text-center">
                          입사일 미등록
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminLeaveOverview;
