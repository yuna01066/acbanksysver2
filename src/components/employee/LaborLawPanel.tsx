import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { differenceInMonths, differenceInYears, differenceInDays } from 'date-fns';
import {
  Calculator, Calendar, Clock, Wallet, AlertCircle, CheckCircle2,
  TrendingUp, Loader2, Save, Settings
} from 'lucide-react';

interface LaborLawSettings {
  id: string;
  year: number;
  minimum_hourly_wage: number;
  weekly_work_hours: number;
  monthly_work_hours: number;
  weekly_holiday_hours: number;
  notes: string;
}

interface LaborLawPanelProps {
  joinDate: string;
  hourlyWage?: number;
  weeklyWorkHours?: number;
  isAdmin?: boolean;
}

// 근로기준법 제60조 기반 연차 계산
const calculateAnnualLeave = (joinDate: string): {
  totalDays: number;
  usedCategory: string;
  breakdown: { label: string; days: number; description: string }[];
} => {
  if (!joinDate) return { totalDays: 0, usedCategory: '입사일 미등록', breakdown: [] };

  const jd = new Date(joinDate);
  const now = new Date();
  const totalMonths = differenceInMonths(now, jd);
  const totalYears = differenceInYears(now, jd);

  const breakdown: { label: string; days: number; description: string }[] = [];

  if (totalMonths < 12) {
    // 1년 미만: 매월 개근 시 1일 (최대 11일)
    const monthsWorked = Math.min(totalMonths, 11);
    breakdown.push({
      label: '입사 1년 미만 월차',
      days: monthsWorked,
      description: `${monthsWorked}개월 개근 기준 (매월 1일, 최대 11일)`,
    });
    return { totalDays: monthsWorked, usedCategory: '1년 미만', breakdown };
  }

  // 1년 이상: 기본 15일
  let baseDays = 15;
  breakdown.push({
    label: '기본 연차',
    days: 15,
    description: '1년 이상 근무 + 80% 이상 출근 시 (근로기준법 제60조 1항)',
  });

  // 3년 이상부터 2년마다 1일 추가 (최대 25일)
  if (totalYears >= 3) {
    const extraDays = Math.floor((totalYears - 1) / 2);
    const cappedExtra = Math.min(extraDays, 10); // 최대 25일 - 15일 = 10일 추가
    baseDays += cappedExtra;
    if (cappedExtra > 0) {
      breakdown.push({
        label: '장기근속 가산',
        days: cappedExtra,
        description: `3년 이상 근무, 2년마다 1일 가산 (근로기준법 제60조 4항)`,
      });
    }
  }

  return {
    totalDays: Math.min(baseDays, 25),
    usedCategory: totalYears >= 3 ? '장기근속' : '1년 이상',
    breakdown,
  };
};

// 주휴수당 계산
const calculateWeeklyHolidayPay = (hourlyWage: number, weeklyHours: number) => {
  if (weeklyHours < 15) return { eligible: false, amount: 0, dailyHours: 0 };
  // 주휴수당 = (주 소정근로시간 / 40) × 8 × 시급
  const dailyHours = (weeklyHours / 40) * 8;
  const amount = dailyHours * hourlyWage;
  return { eligible: true, amount: Math.round(amount), dailyHours: Math.round(dailyHours * 10) / 10 };
};

// 월급 계산 (주휴수당 포함)
const calculateMonthlyPay = (hourlyWage: number, monthlyHours: number, weeklyHolidayPay: number) => {
  const basePay = hourlyWage * monthlyHours;
  // 월 주휴수당 = 주휴수당 × (365/7/12) ≈ 4.345주
  const monthlyHolidayPay = weeklyHolidayPay * (365 / 7 / 12);
  return {
    basePay: Math.round(basePay),
    monthlyHolidayPay: Math.round(monthlyHolidayPay),
    totalPay: Math.round(basePay + monthlyHolidayPay),
  };
};

const LaborLawPanel: React.FC<LaborLawPanelProps> = ({
  joinDate, hourlyWage: initialWage, weeklyWorkHours: initialHours, isAdmin = false,
}) => {
  const [settings, setSettings] = useState<LaborLawSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [customWage, setCustomWage] = useState<number>(0);
  const [customHours, setCustomHours] = useState<number>(40);
  const [editingSettings, setEditingSettings] = useState(false);
  const [editWage, setEditWage] = useState<number>(0);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const currentYear = new Date().getFullYear();
      const { data } = await supabase
        .from('labor_law_settings')
        .select('*')
        .eq('year', currentYear)
        .maybeSingle();
      if (data) {
        setSettings(data as any);
        setCustomWage(initialWage || (data as any).minimum_hourly_wage);
        setCustomHours(initialHours || (data as any).weekly_work_hours);
        setEditWage((data as any).minimum_hourly_wage);
      }
      setLoading(false);
    };
    fetchSettings();
  }, [initialWage, initialHours]);

  const saveMinWage = async () => {
    if (!settings) return;
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from('labor_law_settings')
        .update({ minimum_hourly_wage: editWage })
        .eq('id', settings.id);
      if (error) throw error;
      setSettings({ ...settings, minimum_hourly_wage: editWage });
      setEditingSettings(false);
      toast.success('최저시급이 업데이트되었습니다.');
    } catch (e: any) {
      toast.error('저장 실패: ' + e.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const annualLeave = useMemo(() => calculateAnnualLeave(joinDate), [joinDate]);

  const weeklyHoliday = useMemo(
    () => calculateWeeklyHolidayPay(customWage, customHours),
    [customWage, customHours]
  );

  const monthlyPay = useMemo(
    () => calculateMonthlyPay(customWage, settings?.monthly_work_hours || 209, weeklyHoliday.amount),
    [customWage, settings, weeklyHoliday]
  );

  const isAboveMinWage = settings ? customWage >= settings.minimum_hourly_wage : true;

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const formatKRW = (n: number) => n.toLocaleString('ko-KR') + '원';

  return (
    <div className="space-y-6">
      {/* 최저시급 관리 */}
      <div className="py-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {new Date().getFullYear()}년 최저임금 기준
          </h3>
          {isAdmin && !editingSettings && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingSettings(true)}>
              수정
            </Button>
          )}
        </div>
        {editingSettings ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={editWage}
              onChange={e => setEditWage(Number(e.target.value))}
              className="w-40 h-9 text-sm"
            />
            <span className="text-sm text-muted-foreground">원/시간</span>
            <Button size="sm" className="h-7 text-xs" onClick={saveMinWage} disabled={savingSettings}>
              {savingSettings ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingSettings(false)}>
              취소
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Badge variant="default" className="text-sm px-3 py-1">
              시급 {formatKRW(settings?.minimum_hourly_wage || 10320)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              월 환산 {formatKRW((settings?.minimum_hourly_wage || 10320) * (settings?.monthly_work_hours || 209))}
              (주 {settings?.weekly_work_hours || 40}시간, 월 {settings?.monthly_work_hours || 209}시간 기준)
            </span>
          </div>
        )}
      </div>

      <Separator />

      {/* 급여 시뮬레이터 */}
      <div className="py-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
          <Calculator className="h-4 w-4" />
          급여 시뮬레이터
        </h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <Label className="text-xs text-muted-foreground">시급</Label>
            <div className="relative">
              <Input
                type="number"
                value={customWage}
                onChange={e => setCustomWage(Number(e.target.value))}
                className="h-9 text-sm pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">원</span>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">주간 근로시간</Label>
            <div className="relative">
              <Input
                type="number"
                value={customHours}
                onChange={e => setCustomHours(Number(e.target.value))}
                className="h-9 text-sm pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">시간</span>
            </div>
          </div>
        </div>

        {/* 최저시급 준수 여부 */}
        <div className={`rounded-lg p-3 mb-4 flex items-center gap-2 ${isAboveMinWage ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
          {isAboveMinWage ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          )}
          <span className={`text-sm font-medium ${isAboveMinWage ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {isAboveMinWage
              ? `최저임금 준수 (${formatKRW(settings?.minimum_hourly_wage || 0)} 이상)`
              : `최저임금 미달! (최저 ${formatKRW(settings?.minimum_hourly_wage || 0)})`}
          </span>
        </div>

        {/* 계산 결과 카드들 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="border bg-muted/30">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Wallet className="h-3 w-3" /> 기본급 (월)
              </div>
              <div className="text-lg font-bold">{formatKRW(monthlyPay.basePay)}</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {formatKRW(customWage)} × {settings?.monthly_work_hours || 209}시간
              </div>
            </CardContent>
          </Card>
          <Card className="border bg-muted/30">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> 주휴수당 (월)
              </div>
              <div className="text-lg font-bold">
                {weeklyHoliday.eligible ? formatKRW(monthlyPay.monthlyHolidayPay) : '-'}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {weeklyHoliday.eligible
                  ? `주 ${weeklyHoliday.dailyHours}시간 × ${formatKRW(customWage)} × 4.345주`
                  : '주 15시간 미만 (미대상)'}
              </div>
            </CardContent>
          </Card>
          <Card className="border bg-primary/5">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> 예상 월급 합계
              </div>
              <div className="text-lg font-bold text-primary">{formatKRW(monthlyPay.totalPay)}</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                기본급 + 주휴수당 (세전)
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* 주휴수당 상세 */}
      <div className="py-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4" />
          주휴수당 상세
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">지급 대상 여부</span>
            <Badge variant={weeklyHoliday.eligible ? "default" : "secondary"}>
              {weeklyHoliday.eligible ? '대상' : '미대상'}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">지급 조건</span>
            <span>주 15시간 이상 + 소정근로일 개근</span>
          </div>
          {weeklyHoliday.eligible && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">주휴일 유급시간</span>
                <span>{weeklyHoliday.dailyHours}시간</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">1주 주휴수당</span>
                <span className="font-medium">{formatKRW(weeklyHoliday.amount)}</span>
              </div>
            </>
          )}
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground mt-2">
            <strong>계산식:</strong> (주 소정근로시간 ÷ 40) × 8시간 × 시급<br />
            <strong>근거:</strong> 근로기준법 제55조 (유급휴일)
          </div>
        </div>
      </div>

      <Separator />

      {/* 연차 계산 */}
      <div className="py-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
          <Calendar className="h-4 w-4" />
          연차 유급휴가
        </h3>
        {!joinDate ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            입사일이 등록되지 않았습니다. 입사 정보를 먼저 입력해주세요.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold text-primary">{annualLeave.totalDays}일</div>
              <div>
                <Badge variant="outline" className="text-xs">{annualLeave.usedCategory}</Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  법정 연차 (최대 25일)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {annualLeave.breakdown.map((item, idx) => (
                <div key={idx} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{item.label}</span>
                    <Badge variant="secondary" className="text-xs">{item.days}일</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>

            {/* 연차수당 계산 */}
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="text-xs font-semibold text-muted-foreground mb-2">미사용 연차수당 (전체 미사용 시)</div>
              <div className="text-lg font-bold">
                {formatKRW(annualLeave.totalDays * customWage * 8)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {annualLeave.totalDays}일 × 8시간 × {formatKRW(customWage)} (통상시급)
              </div>
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <strong>연차 발생 기준 (근로기준법 제60조):</strong><br />
              • 1년 미만: 1개월 개근 시 1일 (최대 11일)<br />
              • 1년 이상: 80% 이상 출근 시 15일<br />
              • 3년 이상: 2년마다 1일 가산 (최대 25일)
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LaborLawPanel;
