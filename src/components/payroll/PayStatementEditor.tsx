import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Plus, Save, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { usePayrollAttendanceRecords, type PayStatement, type PayStatementLineItem, type PayStatementSaveInput, type PayStatementStatus } from '@/hooks/useHrSelfService';
import PayStatementPreview, { formatPayrollAmount, toPayrollLineItems } from '@/components/payroll/PayStatementPreview';
import {
  calculatePayrollDraft,
  createDefaultPayrollProfile,
  createDefaultPayrollRateVersion,
  normalizePayrollItems,
  type PayrollDraftResult,
  type PayrollProfile,
  type PayrollRateVersion,
} from '@/services/payrollCalculation';

type PayrollEmployee = {
  id: string;
  full_name: string | null;
  email: string | null;
  department?: string | null;
  position?: string | null;
  employee_number?: string | null;
};

interface PayStatementEditorProps {
  employees: PayrollEmployee[];
  statement?: PayStatement | null;
  onSave: (input: PayStatementSaveInput) => Promise<void>;
  payrollProfiles?: PayrollProfile[];
  rateVersions?: PayrollRateVersion[];
  onSavePayrollProfile?: (profile: PayrollProfile) => Promise<unknown>;
  isSaving?: boolean;
}

const defaultEarnings: PayStatementLineItem[] = [
  { id: 'base', label: '기본급', amount: 0 },
  { id: 'meal', label: '식대', amount: 0 },
  { id: 'fixed', label: '고정수당', amount: 0 },
  { id: 'overtime', label: '연장수당', amount: 0 },
  { id: 'other', label: '기타 지급', amount: 0 },
];

const defaultDeductions: PayStatementLineItem[] = [
  { id: 'pension', label: '국민연금', amount: 0 },
  { id: 'health', label: '건강보험', amount: 0 },
  { id: 'employment', label: '고용보험', amount: 0 },
  { id: 'income_tax', label: '소득세', amount: 0 },
  { id: 'local_tax', label: '지방소득세', amount: 0 },
  { id: 'other', label: '기타 공제', amount: 0 },
];

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = (month: string) => `${month.slice(0, 7)}-01`;
const monthEnd = (month: string) => {
  const [year, monthNumber] = month.slice(0, 7).split('-').map(Number);
  return new Date(year, monthNumber, 0).toISOString().slice(0, 10);
};

const sumItems = (items: PayStatementLineItem[]) => items.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);

const normalizeMonth = (value?: string | null) => (value || today()).slice(0, 7);

const createRow = (prefix: string): PayStatementLineItem => ({
  id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  label: '',
  amount: 0,
});

const getActivePayrollProfile = (profiles: PayrollProfile[], userId: string) =>
  profiles.find((profile) => profile.user_id === userId && profile.status !== 'inactive') || null;

const getActiveRateVersion = (rates: PayrollRateVersion[]) =>
  rates.find((rate) => rate.is_active) || rates[0] || createDefaultPayrollRateVersion();

const profileNumberPatch = (value: string) => Math.max(0, Number(value) || 0);

const LineItemEditor = ({
  title,
  items,
  onChange,
  prefix,
}: {
  title: string;
  items: PayStatementLineItem[];
  onChange: (items: PayStatementLineItem[]) => void;
  prefix: string;
}) => {
  const updateItem = (index: number, patch: Partial<PayStatementLineItem>) => {
    onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{title}</h4>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => onChange([...items, createRow(prefix)])}>
          <Plus className="h-3.5 w-3.5" />
          항목 추가
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={item.id || index} className="grid gap-2 sm:grid-cols-[1.2fr_120px_1fr_36px]">
            <Input value={item.label} onChange={(event) => updateItem(index, { label: event.target.value, source: 'manual' })} placeholder="항목명" />
            <Input
              type="number"
              min={0}
              value={Number(item.amount) || 0}
              onChange={(event) => updateItem(index, { amount: Number(event.target.value) || 0, source: 'manual' })}
              placeholder="금액"
            />
            <Input value={item.note || ''} onChange={(event) => updateItem(index, { note: event.target.value, source: 'manual' })} placeholder="비고" />
            <Button type="button" variant="ghost" size="icon" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

const PayStatementEditor: React.FC<PayStatementEditorProps> = ({
  employees,
  statement,
  onSave,
  payrollProfiles = [],
  rateVersions = [],
  onSavePayrollProfile,
  isSaving,
}) => {
  const initialMonth = normalizeMonth(statement?.pay_month);
  const [selectedUserId, setSelectedUserId] = useState(statement?.user_id || employees[0]?.id || '');
  const [payMonth, setPayMonth] = useState(initialMonth);
  const [payPeriodStart, setPayPeriodStart] = useState(statement?.pay_period_start || monthStart(initialMonth));
  const [payPeriodEnd, setPayPeriodEnd] = useState(statement?.pay_period_end || monthEnd(initialMonth));
  const [paymentDate, setPaymentDate] = useState(statement?.payment_date || today());
  const [earnings, setEarnings] = useState<PayStatementLineItem[]>(
    statement?.earnings ? toPayrollLineItems(statement.earnings) : defaultEarnings,
  );
  const [deductions, setDeductions] = useState<PayStatementLineItem[]>(
    statement?.deductions ? toPayrollLineItems(statement.deductions) : defaultDeductions,
  );
  const [memo, setMemo] = useState(statement?.memo || '');
  const [internalNote, setInternalNote] = useState(statement?.internal_note || '');
  const activeProfile = useMemo(() => getActivePayrollProfile(payrollProfiles, selectedUserId), [payrollProfiles, selectedUserId]);
  const activeRateVersion = useMemo(() => getActiveRateVersion(rateVersions), [rateVersions]);
  const [payrollProfile, setPayrollProfile] = useState<PayrollProfile>(() => activeProfile || createDefaultPayrollProfile(selectedUserId));
  const [calculationResult, setCalculationResult] = useState<PayrollDraftResult | null>(null);
  const { data: attendanceRecords = [], isFetching: attendanceLoading } = usePayrollAttendanceRecords(selectedUserId || null, payPeriodStart || null, payPeriodEnd || null);

  useEffect(() => {
    setPayrollProfile(activeProfile || createDefaultPayrollProfile(selectedUserId));
    setCalculationResult(null);
  }, [activeProfile?.id, selectedUserId]);

  const selectedEmployee = employees.find((employee) => employee.id === selectedUserId) || statement?.profile || null;
  const grossPay = sumItems(earnings);
  const totalDeductions = sumItems(deductions);
  const netPay = grossPay - totalDeductions;
  const hasManualOverride = calculationResult
    ? JSON.stringify(earnings) !== JSON.stringify(calculationResult.earnings)
      || JSON.stringify(deductions) !== JSON.stringify(calculationResult.deductions)
    : false;

  const previewStatement = useMemo(() => ({
    ...statement,
    user_id: selectedUserId,
    pay_month: `${payMonth}-01`,
    pay_period_start: payPeriodStart,
    pay_period_end: payPeriodEnd,
    payment_date: paymentDate,
    earnings,
    deductions,
    gross_pay: grossPay,
    total_deductions: totalDeductions,
    net_pay: netPay,
    memo,
    internal_note: internalNote,
    profile: selectedEmployee,
  }), [deductions, earnings, grossPay, internalNote, memo, netPay, payMonth, payPeriodEnd, payPeriodStart, paymentDate, selectedEmployee, selectedUserId, statement, totalDeductions]);

  const save = async (status: PayStatementStatus) => {
    if (!selectedUserId) throw new Error('직원을 선택해주세요.');
    if (netPay < 0) throw new Error('공제 합계가 지급 합계보다 클 수 없습니다.');

    await onSave({
      id: statement?.id,
      user_id: selectedUserId,
      pay_month: `${payMonth}-01`,
      pay_period_start: payPeriodStart,
      pay_period_end: payPeriodEnd,
      payment_date: paymentDate,
      earnings,
      deductions,
      memo,
      internal_note: internalNote,
      file_storage_path: statement?.file_storage_path || null,
      status,
      calculation_run_id: statement?.calculation_run_id || null,
      rate_version_id: activeRateVersion.id || statement?.rate_version_id || null,
      calculation_basis: calculationResult?.calculationBasis || statement?.calculation_basis || {},
      has_manual_override: hasManualOverride,
      calculation_input_snapshot: calculationResult ? {
        profile: payrollProfile,
        rateVersion: activeRateVersion,
        attendanceRecords,
      } : undefined,
      calculation_result_snapshot: calculationResult ? {
        earnings,
        deductions,
        grossPay,
        totalDeductions,
        netPay,
        attendanceSummary: calculationResult.attendanceSummary,
        warnings: calculationResult.warnings,
        originalAutoResult: {
          earnings: calculationResult.earnings,
          deductions: calculationResult.deductions,
          grossPay: calculationResult.grossPay,
          totalDeductions: calculationResult.totalDeductions,
          netPay: calculationResult.netPay,
        },
      } : undefined,
      calculation_warnings: calculationResult?.warnings,
    });
  };

  const handleMonthChange = (value: string) => {
    setPayMonth(value);
    setPayPeriodStart(monthStart(value));
    setPayPeriodEnd(monthEnd(value));
  };

  const updatePayrollProfile = (patch: Partial<PayrollProfile>) => {
    setPayrollProfile((current) => ({ ...current, ...patch, user_id: selectedUserId }));
    setCalculationResult(null);
  };

  const updateProfileAllowance = (type: 'non_taxable_allowances' | 'fixed_allowances', index: number, patch: Partial<PayStatementLineItem>) => {
    const currentItems = normalizePayrollItems(payrollProfile[type]);
    const seededItems = currentItems.length > index ? currentItems : [
      ...currentItems,
      { id: type === 'non_taxable_allowances' ? 'meal' : 'fixed', label: type === 'non_taxable_allowances' ? '비과세 식대' : '고정수당', amount: 0 },
    ];
    const nextItems = seededItems.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item);
    updatePayrollProfile({ [type]: nextItems } as Partial<PayrollProfile>);
  };

  const generatePayrollDraft = () => {
    if (!selectedUserId) {
      toast.error('직원을 선택해주세요.');
      return;
    }
    const result = calculatePayrollDraft({
      profile: payrollProfile,
      rateVersion: activeRateVersion,
      attendanceRecords,
      payMonth: `${payMonth}-01`,
    });
    setEarnings(result.earnings);
    setDeductions(result.deductions);
    setCalculationResult(result);
    if (result.warnings.length > 0) {
      toast.warning(`자동계산 완료: 검토 필요 ${result.warnings.length}건`);
    } else {
      toast.success('급여명세 자동계산 초안을 생성했습니다.');
    }
  };

  const savePayrollProfile = async () => {
    if (!onSavePayrollProfile) return;
    try {
      await onSavePayrollProfile({ ...payrollProfile, user_id: selectedUserId });
      toast.success('직원 급여 기준을 저장했습니다.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '급여 기준 저장 실패');
    }
  };

  const profileNonTaxable = normalizePayrollItems(payrollProfile.non_taxable_allowances);
  const profileFixedAllowances = normalizePayrollItems(payrollProfile.fixed_allowances);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
      <div className="space-y-5">
        <div className="grid gap-4 rounded-lg border bg-white p-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>직원</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={Boolean(statement?.id)}>
              <SelectTrigger><SelectValue placeholder="직원 선택" /></SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.full_name || employee.email || employee.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>급여월</Label>
            <Input type="month" value={payMonth} onChange={(event) => handleMonthChange(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>산정 시작일</Label>
            <Input type="date" value={payPeriodStart} onChange={(event) => setPayPeriodStart(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>산정 종료일</Label>
            <Input type="date" value={payPeriodEnd} onChange={(event) => setPayPeriodEnd(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>지급일</Label>
            <Input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
          </div>
        </div>

        <div className="space-y-4 rounded-lg border bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <Calculator className="h-4 w-4 text-primary" />
                자동계산 기준
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                직원 급여 기준과 근태 데이터를 바탕으로 지급/공제 초안을 생성합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{activeRateVersion.name || '요율 미설정'}</Badge>
              <Badge variant="outline">{attendanceLoading ? '근태 조회 중' : `근태 ${attendanceRecords.length}건`}</Badge>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label>급여 기준</Label>
              <Select value={payrollProfile.pay_type} onValueChange={(value) => updatePayrollProfile({ pay_type: value as PayrollProfile['pay_type'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">월급</SelectItem>
                  <SelectItem value="annual">연봉</SelectItem>
                  <SelectItem value="hourly">시급</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>월 기본급</Label>
              <Input type="number" min={0} value={payrollProfile.monthly_base_pay || 0} onChange={(event) => updatePayrollProfile({ monthly_base_pay: profileNumberPatch(event.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>연봉</Label>
              <Input type="number" min={0} value={payrollProfile.annual_salary || 0} onChange={(event) => updatePayrollProfile({ annual_salary: profileNumberPatch(event.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>시급</Label>
              <Input type="number" min={0} value={payrollProfile.hourly_wage || 0} onChange={(event) => updatePayrollProfile({ hourly_wage: profileNumberPatch(event.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>월 소정시간</Label>
              <Input type="number" min={1} value={payrollProfile.standard_monthly_hours || 209} onChange={(event) => updatePayrollProfile({ standard_monthly_hours: Math.max(1, Number(event.target.value) || 209) })} />
            </div>
            <div className="space-y-1.5">
              <Label>비과세 식대</Label>
              <Input
                type="number"
                min={0}
                value={profileNonTaxable[0]?.amount || 0}
                onChange={(event) => updateProfileAllowance('non_taxable_allowances', 0, { id: 'meal', label: '비과세 식대', amount: profileNumberPatch(event.target.value), taxable: false })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>고정수당</Label>
              <Input
                type="number"
                min={0}
                value={profileFixedAllowances[0]?.amount || 0}
                onChange={(event) => updateProfileAllowance('fixed_allowances', 0, { id: 'fixed', label: '고정수당', amount: profileNumberPatch(event.target.value), taxable: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>고정연장수당</Label>
              <Input
                type="number"
                min={0}
                value={Number(payrollProfile.overtime_policy?.fixedMonthlyAmount) || 0}
                onChange={(event) => updatePayrollProfile({ overtime_policy: { ...payrollProfile.overtime_policy, enabled: true, mode: 'fixed', fixedMonthlyAmount: profileNumberPatch(event.target.value) } })}
              />
            </div>
          </div>

          <div className="grid gap-3 rounded-lg bg-muted/30 p-3 md:grid-cols-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>근태 연장수당 반영</span>
              <Switch
                checked={Boolean(payrollProfile.overtime_policy?.useAttendanceOvertime)}
                onCheckedChange={(checked) => updatePayrollProfile({ overtime_policy: { ...payrollProfile.overtime_policy, enabled: checked || payrollProfile.overtime_policy?.enabled, mode: checked ? 'attendance' : payrollProfile.overtime_policy?.mode || 'none', useAttendanceOvertime: checked } })}
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>국민연금/건강보험</span>
              <Switch
                checked={payrollProfile.deduction_settings?.nationalPension !== false && payrollProfile.deduction_settings?.healthInsurance !== false}
                onCheckedChange={(checked) => updatePayrollProfile({ deduction_settings: { ...payrollProfile.deduction_settings, nationalPension: checked, healthInsurance: checked, longTermCare: checked } })}
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>소득세/지방세</span>
              <Switch
                checked={payrollProfile.deduction_settings?.incomeTax !== false && payrollProfile.deduction_settings?.localIncomeTax !== false}
                onCheckedChange={(checked) => updatePayrollProfile({ deduction_settings: { ...payrollProfile.deduction_settings, incomeTax: checked, localIncomeTax: checked } })}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="gap-1.5" onClick={savePayrollProfile} disabled={!onSavePayrollProfile || !selectedUserId}>
              <Save className="h-4 w-4" />
              급여 기준 저장
            </Button>
            <Button type="button" className="gap-1.5" onClick={generatePayrollDraft} disabled={!selectedUserId || attendanceLoading}>
              <Wand2 className="h-4 w-4" />
              자동계산 초안 생성
            </Button>
          </div>

          {calculationResult?.warnings.length ? (
            <Alert>
              <AlertDescription>
                <span className="font-medium">검토 필요:</span> {calculationResult.warnings.join(' / ')}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <LineItemEditor title="지급 항목" items={earnings} onChange={setEarnings} prefix="earning" />
        <LineItemEditor title="공제 항목" items={deductions} onChange={setDeductions} prefix="deduction" />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>직원 안내 문구</Label>
            <Textarea value={memo} onChange={(event) => setMemo(event.target.value)} rows={5} placeholder="직원이 볼 수 있는 안내 문구" />
          </div>
          <div className="space-y-1.5">
            <Label>내부 메모</Label>
            <Textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} rows={5} placeholder="관리자용 메모" />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <span>지급 {formatPayrollAmount(grossPay)}</span>
            <span>공제 {formatPayrollAmount(totalDeductions)}</span>
            <span className="font-semibold">실지급 {formatPayrollAmount(netPay)}</span>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => save('draft')} disabled={isSaving}>임시저장</Button>
            <Button type="button" onClick={() => save('published')} disabled={isSaving || netPay < 0}>발행</Button>
          </div>
        </div>
      </div>

      <PayStatementPreview statement={previewStatement} profile={selectedEmployee} showInternalNote />
    </div>
  );
};

export default PayStatementEditor;
