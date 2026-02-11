import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight, ChevronDown, Info } from 'lucide-react';
import { differenceInMonths, differenceInYears } from 'date-fns';
import type { LeaveRequest } from '@/hooks/useLeaveRequests';

interface LeaveDetailTableProps {
  joinDate: string;
  requests: LeaveRequest[];
  grantMethod: string;
  grantBasis: string;
}

const LeaveDetailTable: React.FC<LeaveDetailTableProps> = ({ joinDate, requests, grantMethod, grantBasis }) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const currentMonth = new Date().getMonth() + 1; // 1-based

  const years = useMemo(() => {
    const startYear = joinDate ? new Date(joinDate).getFullYear() : currentYear;
    const ys: number[] = [];
    for (let y = startYear; y <= currentYear + 1; y++) ys.push(y);
    return ys;
  }, [joinDate, currentYear]);

  // Calculate monthly data
  const monthlyData = useMemo(() => {
    if (!joinDate) return [];

    const jd = new Date(joinDate);
    const joinYear = jd.getFullYear();
    const joinMonth = jd.getMonth() + 1;

    const rows = [];
    let cumulative = 0;

    for (let month = 1; month <= 12; month++) {
      const monthDate = new Date(selectedYear, month - 1, 1);
      const totalMonthsSinceJoin = differenceInMonths(monthDate, jd);
      const totalYearsSinceJoin = differenceInYears(monthDate, jd);

      let autoGrant = 0;
      let expired = 0;
      let isAnniversary = false;

      // Calculate auto-grant based on policy
      if (totalMonthsSinceJoin >= 0) {
        if (totalMonthsSinceJoin < 12) {
          // 1년 미만: 매월 1일씩 부여 (개근 가정)
          if (totalMonthsSinceJoin > 0 || (selectedYear === joinYear && month >= joinMonth)) {
            autoGrant = 1;
          }
        } else {
          // 1년 이상: 입사 기념일 월에 연차 일괄 부여
          const anniversaryMonth = jd.getMonth() + 1;
          if (month === anniversaryMonth && totalYearsSinceJoin >= 1) {
            let annualDays = 15;
            if (totalYearsSinceJoin >= 3) {
              annualDays += Math.min(Math.floor((totalYearsSinceJoin - 1) / 2), 10);
            }
            annualDays = Math.min(annualDays, 25);
            autoGrant = annualDays;
            isAnniversary = true;

            // 소멸: 전년도 미사용분 (simplified)
            const prevYearUsed = requests
              .filter(r => r.status === 'approved' && new Date(r.start_date).getFullYear() === selectedYear - 1)
              .reduce((s, r) => s + r.days, 0);
            // Previous year's granted minus used
            let prevGrant = 15;
            if (totalYearsSinceJoin >= 4) {
              prevGrant += Math.min(Math.floor((totalYearsSinceJoin - 2) / 2), 10);
            }
            prevGrant = Math.min(prevGrant, 25);
            const unused = Math.max(prevGrant - prevYearUsed, 0);
            if (unused > 0 && totalYearsSinceJoin >= 2) {
              expired = unused;
            }
          }
        }
      }

      // Used this month
      const used = requests
        .filter(r =>
          r.status === 'approved' &&
          new Date(r.start_date).getFullYear() === selectedYear &&
          new Date(r.start_date).getMonth() + 1 === month
        )
        .reduce((s, r) => s + r.days, 0);

      cumulative += autoGrant - expired - used;

      rows.push({
        month,
        autoGrant,
        expired,
        used,
        adjustment: 0, // placeholder for manual adjustments
        carry: cumulative,
        isAnniversary,
        isCurrent: selectedYear === currentYear && month === currentMonth,
        isFuture: selectedYear > currentYear || (selectedYear === currentYear && month > currentMonth),
      });
    }

    return rows;
  }, [joinDate, selectedYear, requests, currentYear, currentMonth]);

  const totals = useMemo(() => {
    return monthlyData.reduce(
      (acc, r) => ({
        autoGrant: acc.autoGrant + r.autoGrant,
        expired: acc.expired + r.expired,
        used: acc.used + r.used,
        adjustment: acc.adjustment + r.adjustment,
      }),
      { autoGrant: 0, expired: 0, used: 0, adjustment: 0 }
    );
  }, [monthlyData]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">연차 상세 현황</h2>
          <div className="mt-2">
            <Badge variant="secondary" className="text-xs bg-foreground text-background">
              근로기준법에 따라 받은 연차예요.
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[100px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={String(y)}>{y}년</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedYear(y => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedYear(y => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 rounded-lg border p-4">
        <div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <span className="w-0.5 h-3 bg-primary rounded-full" />
            자동 부여
            <Info className="h-3 w-3" />
          </div>
          <p className="text-lg font-bold text-primary">+ {totals.autoGrant}일</p>
        </div>
        <div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <span className="w-0.5 h-3 bg-destructive rounded-full" />
            소멸
            <Info className="h-3 w-3" />
          </div>
          <p className="text-lg font-bold text-destructive">
            {totals.expired > 0 ? `- ${totals.expired}일` : '없음'}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <span className="w-0.5 h-3 bg-muted-foreground rounded-full" />
            사용
            <Info className="h-3 w-3" />
          </div>
          <p className="text-lg font-bold">{totals.used > 0 ? `${totals.used}일` : '없음'}</p>
        </div>
        <div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <span className="w-0.5 h-3 bg-muted-foreground rounded-full" />
            조정
            <Info className="h-3 w-3" />
          </div>
          <p className="text-lg font-bold">{totals.adjustment > 0 ? `${totals.adjustment}일` : '없음'}</p>
        </div>
      </div>

      {/* Monthly table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[160px]">날짜</TableHead>
              <TableHead>자동 부여</TableHead>
              <TableHead>소멸</TableHead>
              <TableHead>사용</TableHead>
              <TableHead>조정</TableHead>
              <TableHead className="w-[40px]" />
              <TableHead className="text-right">잔여</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthlyData.map((row) => (
              <TableRow key={row.month} className={row.isCurrent ? 'bg-muted/20' : ''}>
                <TableCell className="font-medium">
                  <span className={row.isCurrent ? 'text-primary font-semibold' : ''}>
                    {selectedYear}년 {row.month}월
                  </span>
                  {row.isAnniversary && (
                    <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 border-primary text-primary">
                      입사일
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {row.autoGrant > 0 && <span>+{row.autoGrant}일</span>}
                </TableCell>
                <TableCell>
                  {row.expired > 0 && <span className="text-destructive">-{row.expired}일</span>}
                </TableCell>
                <TableCell>
                  {row.used > 0 && <span>{row.used}일</span>}
                </TableCell>
                <TableCell>
                  {row.adjustment !== 0 && <span>{row.adjustment > 0 ? '+' : ''}{row.adjustment}일</span>}
                </TableCell>
                <TableCell>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {row.carry}일
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        소수점 넷째 자리에서 반올림하여 표기된 결과입니다.
      </p>
    </div>
  );
};

export default LeaveDetailTable;
