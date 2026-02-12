import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight, ChevronDown, Info, Pencil } from 'lucide-react';
import { differenceInMonths } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { LeaveRequest } from '@/hooks/useLeaveRequests';

interface LeaveDetailTableProps {
  joinDate: string;
  requests: LeaveRequest[];
  grantMethod: string;
  grantBasis: string;
}

interface MonthRow {
  month: number;
  autoGrant: number;
  expired: number;
  used: number;
  adjustment: number;
  carry: number;
  isAnniversary: boolean;
  isCurrent: boolean;
  isFuture: boolean;
}

/**
 * 전년도 잔여 연차 계산 (캐리오버)
 * 입사일부터 selectedYear 시작 전까지의 월차 부여 - 사용 = 잔여
 */
const calculatePreviousYearCarryover = (
  joinDate: Date,
  selectedYear: number,
  requests: LeaveRequest[]
): number => {
  const joinYear = joinDate.getFullYear();
  const joinMonth = joinDate.getMonth(); // 0-based

  // 선택된 연도가 입사 연도이거나 이전이면 캐리오버 없음
  if (selectedYear <= joinYear) return 0;

  // 입사일부터 selectedYear 1/1까지의 총 월 수
  const endOfPrevYear = new Date(selectedYear, 0, 1); // Jan 1 of selectedYear
  const monthsSinceJoin = differenceInMonths(endOfPrevYear, joinDate);

  if (monthsSinceJoin <= 0) return 0;

  // 1년 미만 기간의 월차 부여 (최대 11일)
  const monthlyGrant = Math.min(monthsSinceJoin, 11);

  // 이전 연도들의 사용량 합산
  const prevYearUsed = requests
    .filter(r =>
      r.status === 'approved' &&
      new Date(r.start_date).getFullYear() < selectedYear &&
      (r.leave_type === 'annual' || r.leave_type === 'monthly')
    )
    .reduce((s, r) => s + r.days, 0);

  // 1년 기념일이 이전 연도에 있었다면 연차도 포함
  const anniversaryDate = new Date(joinDate);
  anniversaryDate.setFullYear(joinDate.getFullYear() + 1);
  let annualGrant = 0;
  if (anniversaryDate < endOfPrevYear) {
    annualGrant = 15;
    // 1년 기념일 시점에 모든 월차 소멸되므로, 캐리오버는 연차 기준으로만
    const annualUsed = requests
      .filter(r =>
        r.status === 'approved' &&
        new Date(r.start_date) >= anniversaryDate &&
        new Date(r.start_date).getFullYear() < selectedYear
      )
      .reduce((s, r) => s + r.days, 0);
    return Math.max(0, annualGrant - annualUsed);
  }

  return Math.max(0, monthlyGrant - prevYearUsed);
};

const LeaveDetailTable: React.FC<LeaveDetailTableProps> = ({ joinDate, requests, grantMethod, grantBasis }) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const currentMonth = new Date().getMonth() + 1;

  const years = useMemo(() => {
    const startYear = joinDate ? new Date(joinDate).getFullYear() : currentYear;
    const ys: number[] = [];
    for (let y = startYear; y <= currentYear + 1; y++) ys.push(y);
    return ys;
  }, [joinDate, currentYear]);

  const prevYearCarryover = useMemo(() => {
    if (!joinDate) return 0;
    return calculatePreviousYearCarryover(new Date(joinDate), selectedYear, requests);
  }, [joinDate, selectedYear, requests]);

  const monthlyData = useMemo(() => {
    if (!joinDate) return [];

    const jd = new Date(joinDate);
    const joinYear = jd.getFullYear();
    const joinMonthIndex = jd.getMonth(); // 0-based
    const anniversaryMonth = joinMonthIndex + 1; // 1-based, same month as join

    const rows: MonthRow[] = [];
    let cumulative = prevYearCarryover;

    // 입사기념일 시점에 소멸할 누적 월차 추적
    let accumulatedMonthlyInYear = 0;

    for (let month = 1; month <= 12; month++) {
      const monthDate = new Date(selectedYear, month - 1, 1);
      const totalMonthsSinceJoin = differenceInMonths(monthDate, jd);

      let autoGrant = 0;
      let expired = 0;
      let isAnniversary = false;

      if (totalMonthsSinceJoin < 0) {
        // 입사 전
        rows.push({
          month, autoGrant: 0, expired: 0, used: 0, adjustment: 0,
          carry: cumulative, isAnniversary: false,
          isCurrent: selectedYear === currentYear && month === currentMonth,
          isFuture: selectedYear > currentYear || (selectedYear === currentYear && month > currentMonth),
        });
        continue;
      }

      if (totalMonthsSinceJoin < 12) {
        // 1년 미만: 매월 1일 부여 (첫 달 제외, 만 1개월 근무 후부터)
        if (totalMonthsSinceJoin > 0) {
          autoGrant = 1;
          accumulatedMonthlyInYear += 1;
        }
      } else {
        // 1년 이상
        // 입사 기념일 월에 연차 부여 + 월차 소멸
        if (month === anniversaryMonth) {
          const yearsWorked = Math.floor(totalMonthsSinceJoin / 12);

          if (yearsWorked >= 1) {
            // 연차 부여
            let annualDays = 15;
            if (yearsWorked >= 3) {
              annualDays += Math.min(Math.floor((yearsWorked - 1) / 2), 10);
            }
            annualDays = Math.min(annualDays, 25);
            autoGrant = annualDays;
            isAnniversary = true;

            // 1년차 입사기념일: 누적 월차 전부 소멸
            if (yearsWorked === 1) {
              // 올해 누적 월차 + 전년도 캐리오버(월차분) 모두 소멸
              const totalMonthlyToExpire = accumulatedMonthlyInYear + prevYearCarryover;
              if (totalMonthlyToExpire > 0) {
                expired = totalMonthlyToExpire;
              }
            }
          }
        }
      }

      // 해당 월 사용량
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
        adjustment: 0,
        carry: Math.round(cumulative * 100) / 100,
        isAnniversary,
        isCurrent: selectedYear === currentYear && month === currentMonth,
        isFuture: selectedYear > currentYear || (selectedYear === currentYear && month > currentMonth),
      });
    }

    return rows;
  }, [joinDate, selectedYear, requests, currentYear, currentMonth, prevYearCarryover]);

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
        <h2 className="text-lg font-semibold">연차 상세 현황</h2>
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger><Info className="h-3 w-3" /></TooltipTrigger>
                <TooltipContent><p className="text-xs">근로기준법에 따라 자동 부여된 연차입니다.</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-lg font-bold text-primary">+ {totals.autoGrant}일</p>
        </div>
        <div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <span className="w-0.5 h-3 bg-destructive rounded-full" />
            소멸
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger><Info className="h-3 w-3" /></TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">근로기준법상 소멸 기한과 회사에서 설정한 유예기간이 지나 소멸된 연차예요.</p>
                  <div className="mt-1 text-xs text-muted-foreground">연차 소멸 기한: 부여 후 1년</div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
          <p className="text-lg font-bold">{totals.adjustment !== 0 ? `${totals.adjustment}일` : '없음'}</p>
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
              <TableHead className="w-[40px]">
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </TableHead>
              <TableHead className="text-right">
                <div className="flex flex-col items-end">
                  <span>잔여</span>
                  {prevYearCarryover > 0 && (
                    <span className="text-xs font-normal text-primary">전년도 잔여 +{prevYearCarryover}일</span>
                  )}
                </div>
              </TableHead>
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
        소수점 넷째 자리에서 반올림하여 표기한 결과입니다.
      </p>
    </div>
  );
};

export default LeaveDetailTable;
