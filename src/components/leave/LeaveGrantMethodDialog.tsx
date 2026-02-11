import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { addMonths, differenceInMonths, differenceInYears, differenceInCalendarDays, format } from 'date-fns';

interface LeaveGrantMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grantBasis: string;
  fiscalYearMonth: number;
  monthlyLeaveMethod: string;
  annualLeaveMethod: string;
  decimalRounding: string;
  onUpdate: (updates: {
    grant_basis?: string;
    fiscal_year_month?: number;
    monthly_leave_method?: string;
    annual_leave_method?: string;
    decimal_rounding?: string;
  }) => void;
}

const MONTHLY_LEAVE_OPTIONS_FISCAL = [
  { value: 'monthly_accrual', label: '매월 개근시 1일 부여', recommended: true },
  { value: 'upfront_11', label: '입사일에 11일 선부여', recommended: false },
  { value: 'upfront_to_fiscal', label: '입사일에 회계일까지의 월차 선부여', recommended: false },
];

const MONTHLY_LEAVE_OPTIONS_JOIN = [
  { value: 'monthly_accrual', label: '매월 개근시 1일 부여', recommended: true },
  { value: 'upfront_11', label: '입사일에 11일 선부여', recommended: false },
];

const ANNUAL_LEAVE_OPTIONS_FISCAL = [
  { value: 'first_fiscal_15', label: '첫 회계일에 15일 부여', recommended: false },
  { value: 'proportional_grant', label: '첫 회계일에 근무한 기간의 연차 부여', recommended: true },
  { value: 'upfront_to_fiscal', label: '입사일에 회계일까지 연차 선부여', recommended: false },
];

const ANNUAL_LEAVE_OPTIONS_JOIN = [
  { value: 'annual_15', label: '1년 만근시 15일 부여', recommended: true },
  { value: 'upfront_join_15', label: '입사일에 15일 선부여', recommended: false },
];

const DECIMAL_ROUNDING_OPTIONS = [
  { value: 'round_up_day', label: '일 단위 올림 처리', recommended: true },
  { value: 'round_up_half', label: '반차 단위 올림 처리', recommended: false },
  { value: 'none', label: '조정 안 함', description: '소수점 이하의 휴가는 임의로 공제할 수 없으며, 사용되지 않은 만큼 수당으로 지급해야 해요.' },
];

const FISCAL_MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}월 1일`,
}));

const LeaveGrantMethodDialog: React.FC<LeaveGrantMethodDialogProps> = ({
  open, onOpenChange, grantBasis, fiscalYearMonth, monthlyLeaveMethod,
  annualLeaveMethod, decimalRounding, onUpdate,
}) => {
  const [tab, setTab] = useState<'fiscal_year' | 'join_date'>(grantBasis === 'fiscal_year' ? 'fiscal_year' : 'join_date');
  const [settingsExpanded, setSettingsExpanded] = useState(true);

  const handleTabChange = (newTab: 'fiscal_year' | 'join_date') => {
    setTab(newTab);
    onUpdate({ grant_basis: newTab === 'fiscal_year' ? 'fiscal_year' : 'join_date' });
  };

  const monthlyOptions = tab === 'fiscal_year' ? MONTHLY_LEAVE_OPTIONS_FISCAL : MONTHLY_LEAVE_OPTIONS_JOIN;
  const annualOptions = tab === 'fiscal_year' ? ANNUAL_LEAVE_OPTIONS_FISCAL : ANNUAL_LEAVE_OPTIONS_JOIN;

  // Preview: generate auto-grant schedule based on today as join date
  const previewData = useMemo(() => {
    const joinDate = new Date();
    const rows: Array<{
      date: string;
      badge?: string;
      badgeColor?: string;
      monthly: string;
      annual: string;
    }> = [];

    // First row: join date
    rows.push({
      date: format(joinDate, 'yyyy. M. d'),
      badge: '입사일',
      badgeColor: 'bg-primary text-primary-foreground',
      monthly: '-',
      annual: '-',
    });

    // Monthly leave (months 1-11)
    for (let m = 1; m <= 11; m++) {
      const d = addMonths(joinDate, m);
      const monthlyVal = monthlyLeaveMethod === 'upfront_11' && m === 0 ? '11일' : '1일';
      rows.push({
        date: format(d, 'yyyy. M. d'),
        monthly: monthlyLeaveMethod === 'upfront_11' ? '-' : monthlyVal,
        annual: '-',
      });
    }

    // Annual leave from year 2 onwards
    for (let y = 1; y <= 5; y++) {
      const yearsSince = y;
      let annualDays = 15;
      if (yearsSince >= 3) {
        annualDays += Math.min(Math.floor((yearsSince - 1) / 2), 10);
      }
      annualDays = Math.min(annualDays, 25);

      if (tab === 'fiscal_year') {
        const fiscalDate = new Date(joinDate.getFullYear() + y, fiscalYearMonth - 1, 1);
        const badgeLabel = `${y}번째 회계일`;
        
        // First fiscal year: proportional
        if (y === 1 && annualLeaveMethod === 'proportional_grant') {
          const joinToFiscal = differenceInCalendarDays(fiscalDate, joinDate);
          const totalDaysInYear = 365;
          const ratio = Math.min(joinToFiscal / totalDaysInYear, 1);
          const proportional = Math.round(15 * ratio * 100) / 100;
          const rounded = decimalRounding === 'round_up_day' ? Math.ceil(proportional) : 
                          decimalRounding === 'round_up_half' ? Math.ceil(proportional * 2) / 2 : proportional;
          rows.push({
            date: format(fiscalDate, 'yyyy. M. d'),
            badge: badgeLabel,
            badgeColor: 'bg-blue-100 text-blue-700',
            monthly: '-',
            annual: `${rounded}일`,
          });

          // Additional monthly leave after fiscal year if within first 12 months
          const monthsToFiscal = differenceInMonths(fiscalDate, joinDate);
          if (monthsToFiscal < 12) {
            const remainingMonths = 12 - monthsToFiscal;
            for (let rm = 1; rm < remainingMonths; rm++) {
              const d = addMonths(fiscalDate, rm);
              rows.push({
                date: format(d, 'yyyy. M. d'),
                monthly: '1일',
                annual: '-',
              });
            }
          }
        } else {
          rows.push({
            date: format(fiscalDate, 'yyyy. M. d'),
            badge: badgeLabel,
            badgeColor: 'bg-blue-100 text-blue-700',
            monthly: '-',
            annual: `${annualDays}일`,
          });
        }
      } else {
        const anniversaryDate = new Date(joinDate);
        anniversaryDate.setFullYear(joinDate.getFullYear() + y);
        rows.push({
          date: format(anniversaryDate, 'yyyy. M. d'),
          badge: `${y + 1}년차`,
          badgeColor: 'bg-blue-100 text-blue-700',
          monthly: '-',
          annual: `${annualDays}일`,
        });
      }
    }

    return rows;
  }, [tab, fiscalYearMonth, monthlyLeaveMethod, annualLeaveMethod, decimalRounding]);

  const startDateStr = useMemo(() => {
    const now = new Date();
    const year = tab === 'fiscal_year' ? now.getFullYear() : now.getFullYear();
    const month = tab === 'fiscal_year' ? fiscalYearMonth : now.getMonth() + 1;
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const d = new Date(year, month - 1, 1);
    return `${year}년 ${month}월 1일 (${dayNames[d.getDay()]})`;
  }, [tab, fiscalYearMonth]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">연차 부여 방식</h2>
            <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-300 bg-emerald-50">
              <Calendar className="h-3.5 w-3.5" />
              부여 시작일: {startDateStr}
            </Badge>
          </div>

          {/* Tabs */}
          <div className="flex border rounded-lg overflow-hidden">
            <button
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === 'fiscal_year' ? 'bg-foreground text-background' : 'bg-background hover:bg-muted'}`}
              onClick={() => handleTabChange('fiscal_year')}
            >
              회계일
            </button>
            <button
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === 'join_date' ? 'bg-foreground text-background' : 'bg-background hover:bg-muted'}`}
              onClick={() => handleTabChange('join_date')}
            >
              입사일
            </button>
          </div>

          {/* Info box */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-start gap-2">
              <Badge className="bg-foreground text-background text-[10px] px-1.5 py-0 mt-0.5">안내</Badge>
              <div>
                <p className="text-sm font-medium">
                  {tab === 'fiscal_year'
                    ? '연차가 일괄 부여되니 부여, 촉진 등의 관리가 쉬울 수 있어요.'
                    : '입사하는 날을 기준으로 연차가 자동 부여돼요.'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {tab === 'fiscal_year'
                    ? '단, 취업규칙에 회계 연도 기준으로 연차를 부여한다는 규정이 명시되어 있아야 하고, 구성원의 퇴직시에는 입사일 부여 기준으로 다시 계산하여 정산이 필요한 점을 참고해 주세요.'
                    : '구성원마다 부여일, 촉진 시점이 모두 달라서 복잡할 수 있지만, 플렉스에선 구성원의 입사일에 맞춰 연차 자동 부여, 자동 촉진이 가능해요.'}
                </p>
              </div>
            </div>
          </div>

          {/* Fiscal year month selector (only for fiscal year tab) */}
          {tab === 'fiscal_year' && (
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">회계일</label>
              <Select value={String(fiscalYearMonth)} onValueChange={v => onUpdate({ fiscal_year_month: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FISCAL_MONTHS.map(m => (
                    <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Monthly leave method */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <TooltipProvider>
                <div className="flex items-center gap-1">
                  <label className="text-sm text-muted-foreground">입사자 월차</label>
                  <Tooltip>
                    <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent>1년 미만 근무자에게 부여되는 월차 방식</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
              <Select value={monthlyLeaveMethod} onValueChange={v => onUpdate({ monthly_leave_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthlyOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        {opt.label}
                        {opt.recommended && <Badge variant="outline" className="text-[10px] px-1 py-0 border-emerald-400 text-emerald-600">추천</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Annual leave method */}
            <div className="space-y-1.5">
              <TooltipProvider>
                <div className="flex items-center gap-1">
                  <label className="text-sm text-muted-foreground">입사자 1년 만근 연차</label>
                  <Tooltip>
                    <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent>1년 이상 근무자에게 부여되는 연차 방식</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
              <Select value={annualLeaveMethod} onValueChange={v => onUpdate({ annual_leave_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {annualOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        {opt.label}
                        {opt.recommended && <Badge variant="outline" className="text-[10px] px-1 py-0 border-emerald-400 text-emerald-600">추천</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Helper links */}
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Info className="h-3.5 w-3.5" />
              <span>법적으로 정해진 연차 외에 추가 부여가 필요한가요?</span>
              <button className="text-primary underline hover:no-underline font-medium">연차 추가 부여하기</button>
            </div>
            <div className="flex items-center gap-1">
              <Info className="h-3.5 w-3.5" />
              <span>그룹 입사일이 설정된 구성원이 있나요?</span>
              <button className="text-primary underline hover:no-underline font-medium">그룹 입사일 기준으로 설정하기</button>
            </div>
          </div>

          {/* Collapsible settings toggle */}
          <button
            className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => setSettingsExpanded(v => !v)}
          >
            설정 {settingsExpanded ? '닫기' : '열기'} {settingsExpanded ? '∧' : '∨'}
          </button>

          {/* Decimal rounding (fiscal year only, inside collapsible) */}
          {settingsExpanded && tab === 'fiscal_year' && (
            <div className="space-y-1.5">
              <TooltipProvider>
                <div className="flex items-center gap-1">
                  <label className="text-sm text-muted-foreground">소수점 이하 연차</label>
                  <Tooltip>
                    <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent>비례 부여 시 소수점 연차 처리 방식</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
              <Select value={decimalRounding} onValueChange={v => onUpdate({ decimal_rounding: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DECIMAL_ROUNDING_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div>
                        <div className="flex items-center gap-2">
                          {opt.label}
                          {opt.recommended && <Badge variant="outline" className="text-[10px] px-1 py-0 border-emerald-400 text-emerald-600">추천</Badge>}
                        </div>
                        {opt.description && <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Preview table */}
          <div className="space-y-3">
            <h3 className="font-semibold">연차 자동 부여 미리보기</h3>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[200px]">미리보기 날짜</TableHead>
                    <TableHead>월차 (입사 1년 미만)</TableHead>
                    <TableHead>연차</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, idx) => (
                    <TableRow key={idx} className={row.badge === '입사일' ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{row.date}</span>
                          {row.badge && (
                            <Badge className={`text-[10px] px-1.5 py-0 ${row.badgeColor}`}>
                              {row.badge}
                            </Badge>
                          )}
                          {row.badge === '입사일' && <span className="text-muted-foreground">▼</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.monthly}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.annual}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeaveGrantMethodDialog;
