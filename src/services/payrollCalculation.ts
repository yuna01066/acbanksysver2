import type { PayStatementLineItem } from '@/hooks/useHrSelfService';

export type PayrollPayType = 'monthly' | 'annual' | 'hourly';
export type PayrollLineSource = 'auto' | 'manual';

export type PayrollLineItem = PayStatementLineItem & {
  source?: PayrollLineSource;
  taxable?: boolean;
  formula_key?: string;
};

export interface PayrollProfile {
  id?: string;
  user_id: string;
  pay_type: PayrollPayType;
  monthly_base_pay: number;
  annual_salary: number;
  hourly_wage: number;
  standard_monthly_hours: number;
  non_taxable_allowances: PayrollLineItem[];
  fixed_allowances: PayrollLineItem[];
  overtime_policy: {
    enabled?: boolean;
    mode?: 'none' | 'fixed' | 'attendance';
    fixedMonthlyAmount?: number;
    fixedMonthlyHours?: number;
    useAttendanceOvertime?: boolean;
    dailyStandardHours?: number;
    overtimeMultiplier?: number;
    nightMultiplier?: number;
    holidayMultiplier?: number;
    deductUnpaidAbsence?: boolean;
  };
  deduction_settings: {
    nationalPension?: boolean;
    healthInsurance?: boolean;
    longTermCare?: boolean;
    employmentInsurance?: boolean;
    incomeTax?: boolean;
    localIncomeTax?: boolean;
  };
  effective_from?: string;
  effective_to?: string | null;
  status?: 'active' | 'inactive';
}

export interface PayrollRateVersion {
  id?: string;
  name: string;
  effective_from: string;
  national_pension_rate: number;
  health_insurance_rate: number;
  long_term_care_rate: number;
  employment_insurance_rate: number;
  local_income_tax_rate: number;
  income_tax_mode: 'manual_rate' | 'flat_amount';
  income_tax_config: {
    manualRate?: number;
    flatAmount?: number;
  };
  is_active?: boolean;
}

export interface PayrollAttendanceRecord {
  date: string;
  check_in?: string | null;
  check_out?: string | null;
  work_hours?: number | null;
  status?: string | null;
}

export interface PayrollAttendanceSummary {
  workDays: number;
  absentDays: number;
  totalWorkHours: number;
  overtimeHours: number;
  invalidRecords: number;
}

export interface PayrollDraftResult {
  earnings: PayrollLineItem[];
  deductions: PayrollLineItem[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  attendanceSummary: PayrollAttendanceSummary;
  warnings: string[];
  calculationBasis: Record<string, unknown>;
}

const roundWon = (value: number) => Math.max(0, Math.round(Number(value) || 0));
const toRate = (value: number | undefined | null) => Math.max(0, Number(value) || 0);

export const createDefaultPayrollProfile = (userId: string): PayrollProfile => ({
  user_id: userId,
  pay_type: 'monthly',
  monthly_base_pay: 0,
  annual_salary: 0,
  hourly_wage: 0,
  standard_monthly_hours: 209,
  non_taxable_allowances: [{ id: 'meal', label: '비과세 식대', amount: 0, source: 'auto', taxable: false }],
  fixed_allowances: [{ id: 'fixed', label: '고정수당', amount: 0, source: 'auto', taxable: true }],
  overtime_policy: {
    enabled: false,
    mode: 'none',
    fixedMonthlyAmount: 0,
    fixedMonthlyHours: 0,
    useAttendanceOvertime: false,
    dailyStandardHours: 8,
    overtimeMultiplier: 1.5,
    nightMultiplier: 0.5,
    holidayMultiplier: 1.5,
    deductUnpaidAbsence: false,
  },
  deduction_settings: {
    nationalPension: true,
    healthInsurance: true,
    longTermCare: true,
    employmentInsurance: true,
    incomeTax: true,
    localIncomeTax: true,
  },
  status: 'active',
});

export const createDefaultPayrollRateVersion = (): PayrollRateVersion => ({
  name: '기본 급여 요율',
  effective_from: new Date().toISOString().slice(0, 10),
  national_pension_rate: 0,
  health_insurance_rate: 0,
  long_term_care_rate: 0,
  employment_insurance_rate: 0,
  local_income_tax_rate: 0.1,
  income_tax_mode: 'manual_rate',
  income_tax_config: { manualRate: 0, flatAmount: 0 },
  is_active: true,
});

export const normalizePayrollItems = (value: unknown): PayrollLineItem[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => ({
    id: typeof item?.id === 'string' ? item.id : String(index),
    label: typeof item?.label === 'string' ? item.label : '항목',
    amount: roundWon(Number(item?.amount) || 0),
    note: typeof item?.note === 'string' ? item.note : undefined,
    source: item?.source === 'manual' ? 'manual' : 'auto',
    taxable: typeof item?.taxable === 'boolean' ? item.taxable : true,
    formula_key: typeof item?.formula_key === 'string' ? item.formula_key : undefined,
  }));
};

export const summarizePayrollAttendance = (
  records: PayrollAttendanceRecord[],
  dailyStandardHours = 8,
): PayrollAttendanceSummary => {
  return records.reduce<PayrollAttendanceSummary>((summary, record) => {
    const status = record.status || '';
    const hours = Number(record.work_hours) || 0;
    if (status === 'absent') summary.absentDays += 1;
    if (hours > 0) {
      summary.workDays += 1;
      summary.totalWorkHours += hours;
      summary.overtimeHours += Math.max(0, hours - dailyStandardHours);
    } else if (record.check_in && !record.check_out) {
      summary.invalidRecords += 1;
    }
    return summary;
  }, { workDays: 0, absentDays: 0, totalWorkHours: 0, overtimeHours: 0, invalidRecords: 0 });
};

const calculateBasePay = (profile: PayrollProfile, attendance: PayrollAttendanceSummary) => {
  if (profile.pay_type === 'annual') return roundWon(profile.annual_salary / 12);
  if (profile.pay_type === 'hourly') {
    const hours = attendance.totalWorkHours > 0 ? attendance.totalWorkHours : profile.standard_monthly_hours;
    return roundWon(profile.hourly_wage * hours);
  }
  return roundWon(profile.monthly_base_pay);
};

export const calculatePayrollDraft = ({
  profile,
  rateVersion,
  attendanceRecords,
  payMonth,
}: {
  profile: PayrollProfile;
  rateVersion: PayrollRateVersion;
  attendanceRecords: PayrollAttendanceRecord[];
  payMonth: string;
}): PayrollDraftResult => {
  const warnings: string[] = [];
  const dailyStandardHours = Number(profile.overtime_policy?.dailyStandardHours) || 8;
  const attendanceSummary = summarizePayrollAttendance(attendanceRecords, dailyStandardHours);
  const basePay = calculateBasePay(profile, attendanceSummary);
  if (basePay <= 0) warnings.push('급여 기준 금액이 0원입니다. 직원 급여 기준을 확인해주세요.');
  if (attendanceSummary.invalidRecords > 0) warnings.push('퇴근 기록이 없는 근태가 있어 실제 근무시간 계산에 제외될 수 있습니다.');

  const earnings: PayrollLineItem[] = [
    { id: 'base_pay', label: '기본급', amount: basePay, source: 'auto', taxable: true, formula_key: profile.pay_type },
  ];

  normalizePayrollItems(profile.non_taxable_allowances).forEach((item) => {
    if (item.amount > 0) earnings.push({ ...item, taxable: false, source: item.source || 'auto' });
  });

  normalizePayrollItems(profile.fixed_allowances).forEach((item) => {
    if (item.amount > 0) earnings.push({ ...item, taxable: item.taxable !== false, source: item.source || 'auto' });
  });

  const overtimePolicy = profile.overtime_policy || {};
  const baseHourlyWage = profile.pay_type === 'hourly'
    ? Number(profile.hourly_wage) || 0
    : basePay / Math.max(1, Number(profile.standard_monthly_hours) || 209);

  if (overtimePolicy.enabled) {
    if (overtimePolicy.mode === 'fixed' && Number(overtimePolicy.fixedMonthlyAmount) > 0) {
      earnings.push({
        id: 'fixed_overtime',
        label: '고정연장수당',
        amount: roundWon(Number(overtimePolicy.fixedMonthlyAmount)),
        source: 'auto',
        taxable: true,
        formula_key: 'fixed_overtime',
        note: Number(overtimePolicy.fixedMonthlyHours) > 0 ? `${overtimePolicy.fixedMonthlyHours}시간 기준` : undefined,
      });
    }

    if (overtimePolicy.useAttendanceOvertime || overtimePolicy.mode === 'attendance') {
      const overtimeAmount = roundWon(attendanceSummary.overtimeHours * baseHourlyWage * (Number(overtimePolicy.overtimeMultiplier) || 1.5));
      if (overtimeAmount > 0) {
        earnings.push({
          id: 'attendance_overtime',
          label: '연장수당',
          amount: overtimeAmount,
          source: 'auto',
          taxable: true,
          formula_key: 'attendance_overtime',
          note: `${attendanceSummary.overtimeHours.toFixed(1)}시간`,
        });
      }
    }
  }

  const grossPay = earnings.reduce((sum, item) => sum + roundWon(item.amount), 0);
  const taxablePay = earnings
    .filter((item) => item.taxable !== false)
    .reduce((sum, item) => sum + roundWon(item.amount), 0);

  const deductionSettings = profile.deduction_settings || {};
  const deductions: PayrollLineItem[] = [];
  const pushDeduction = (enabled: boolean | undefined, id: string, label: string, amount: number, note?: string) => {
    if (enabled === false) return;
    const rounded = roundWon(amount);
    if (rounded > 0) deductions.push({ id, label, amount: rounded, source: 'auto', formula_key: id, note });
  };

  pushDeduction(deductionSettings.nationalPension, 'national_pension', '국민연금', taxablePay * toRate(rateVersion.national_pension_rate));
  const healthInsurance = taxablePay * toRate(rateVersion.health_insurance_rate);
  pushDeduction(deductionSettings.healthInsurance, 'health_insurance', '건강보험', healthInsurance);
  pushDeduction(deductionSettings.longTermCare, 'long_term_care', '장기요양보험', healthInsurance * toRate(rateVersion.long_term_care_rate));
  pushDeduction(deductionSettings.employmentInsurance, 'employment_insurance', '고용보험', taxablePay * toRate(rateVersion.employment_insurance_rate));

  const incomeTax = rateVersion.income_tax_mode === 'flat_amount'
    ? roundWon(Number(rateVersion.income_tax_config?.flatAmount) || 0)
    : roundWon(taxablePay * toRate(rateVersion.income_tax_config?.manualRate));
  pushDeduction(deductionSettings.incomeTax, 'income_tax', '소득세', incomeTax, rateVersion.income_tax_mode === 'flat_amount' ? '고정 금액' : '수동 세율');
  pushDeduction(deductionSettings.localIncomeTax, 'local_income_tax', '지방소득세', incomeTax * toRate(rateVersion.local_income_tax_rate));

  const totalDeductions = deductions.reduce((sum, item) => sum + roundWon(item.amount), 0);
  const netPay = grossPay - totalDeductions;
  if (netPay < 0) warnings.push('공제 합계가 지급 합계보다 큽니다.');
  if (!rateVersion.id) warnings.push('저장된 급여 요율 버전이 없어 기본값으로 계산했습니다.');
  if ([rateVersion.national_pension_rate, rateVersion.health_insurance_rate, rateVersion.employment_insurance_rate].every((rate) => Number(rate) === 0)) {
    warnings.push('4대보험 요율이 0으로 설정되어 있습니다. 운영 전 요율 설정을 확인해주세요.');
  }

  return {
    earnings,
    deductions,
    grossPay,
    totalDeductions,
    netPay,
    attendanceSummary,
    warnings,
    calculationBasis: {
      payMonth,
      payType: profile.pay_type,
      standardMonthlyHours: profile.standard_monthly_hours,
      taxablePay,
      rateVersion: {
        id: rateVersion.id || null,
        name: rateVersion.name,
        effectiveFrom: rateVersion.effective_from,
      },
      attendanceSummary,
    },
  };
};
