import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type {
  PayrollAttendanceRecord,
  PayrollProfile,
  PayrollRateVersion,
} from '@/services/payrollCalculation';

export type ProfileChangeStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type HrRequestStatus = 'pending' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';
export type HrTaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type PayStatementStatus = 'draft' | 'published' | 'voided';

export type PayStatementLineItem = {
  id?: string;
  label: string;
  amount: number;
  note?: string;
  source?: 'auto' | 'manual';
  taxable?: boolean;
  formula_key?: string;
};

export const DIRECT_PROFILE_FIELDS = [
  'nickname',
  'phone',
  'personal_email',
  'address',
  'detail_address',
  'zipcode',
  'bank_name',
  'bank_account',
  'avatar_url',
] as const;

export const PROFILE_FIELD_LABELS: Record<string, string> = {
  full_name: '이름',
  nickname: '닉네임',
  phone: '휴대전화',
  personal_email: '개인 이메일',
  address: '주소',
  detail_address: '상세주소',
  zipcode: '우편번호',
  bank_name: '은행명',
  bank_account: '계좌번호',
  avatar_url: '프로필 사진',
  employee_number: '사번',
  department: '부서',
  position: '직책',
  job_title: '직무',
  job_group: '직군',
  rank_title: '직위',
  rank_level: '직급',
  join_date: '입사일',
  group_join_date: '그룹 입사일',
  join_type: '입사 구분',
  work_type: '근무 유형',
  work_hours_per_week: '주당 근무시간',
  overtime_policy: '초과근무 정책',
  salary_info: '급여 지급 정보',
  wage_contract: '임금 계약 정보',
  leave_policy: '휴가 정책',
  holidays: '쉬는 날',
  leave_history: '휴직 이력',
  awards: '수상',
  disciplinary: '징계',
  career_history: '경력',
  education: '학력',
  special_notes: '특이사항',
  family_info: '가족 정보',
};

export interface HrProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  department: string | null;
  position: string | null;
  employee_number: string | null;
  birthday: string | null;
  address: string | null;
  detail_address: string | null;
  zipcode: string | null;
  nationality: string | null;
  bank_name: string | null;
  bank_account: string | null;
  join_date: string | null;
  group_join_date: string | null;
  join_type: string | null;
  job_title: string | null;
  job_group: string | null;
  rank_title: string | null;
  rank_level: string | null;
  nickname: string | null;
  personal_email: string | null;
  work_type: string | null;
  work_hours_per_week: number | null;
  overtime_policy: string | null;
  salary_info: string | null;
  wage_contract: string | null;
  leave_policy: string | null;
  holidays: string | null;
  leave_history: string | null;
  awards: string | null;
  disciplinary: string | null;
  career_history: string | null;
  education: string | null;
  special_notes: string | null;
  family_info: string | null;
  avatar_url: string | null;
}

export interface ProfileChangeRequest {
  id: string;
  user_id: string;
  requested_by: string;
  changes: Record<string, unknown>;
  status: ProfileChangeStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  created_at: string;
  updated_at: string;
  profile?: {
    full_name: string | null;
    email: string | null;
    department: string | null;
    position: string | null;
  } | null;
}

export interface HrRequest {
  id: string;
  user_id: string;
  request_type: string;
  payload: Record<string, unknown>;
  status: HrRequestStatus;
  admin_comment: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayStatement {
  id: string;
  user_id: string;
  pay_month: string;
  status?: PayStatementStatus;
  pay_period_start?: string | null;
  pay_period_end?: string | null;
  payment_date?: string | null;
  gross_pay: number | null;
  earnings?: PayStatementLineItem[] | Record<string, unknown>;
  deductions: PayStatementLineItem[] | Record<string, unknown>;
  total_deductions?: number | null;
  net_pay: number | null;
  memo?: string | null;
  internal_note?: string | null;
  issued_by?: string | null;
  issued_at?: string | null;
  voided_by?: string | null;
  voided_at?: string | null;
  void_reason?: string | null;
  viewed_at?: string | null;
  downloaded_at?: string | null;
  calculation_run_id?: string | null;
  rate_version_id?: string | null;
  calculation_basis?: Record<string, unknown>;
  has_manual_override?: boolean | null;
  file_storage_path: string | null;
  published_at: string | null;
  created_at: string;
  profile?: {
    full_name: string | null;
    email: string | null;
    department: string | null;
    position: string | null;
    employee_number?: string | null;
  } | null;
}

export interface PayStatementEvent {
  id: string;
  pay_statement_id: string;
  user_id: string | null;
  actor_id: string | null;
  event_type: 'created' | 'updated' | 'published' | 'viewed' | 'downloaded' | 'voided' | 'calculated' | 'manual_adjusted' | 'payroll_profile_updated' | 'payroll_rate_updated';
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface EmployeeHrTask {
  id: string;
  user_id: string;
  task_type: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: HrTaskStatus;
  linked_resource: Record<string, unknown>;
  assigned_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

type SupabaseErrorLike = { message?: string } | null;
type SupabaseResult<T = unknown> = { data: T | null; error: SupabaseErrorLike };
type HrQueryBuilder<T = unknown> = PromiseLike<SupabaseResult<T>> & {
  select(columns?: string): HrQueryBuilder<T>;
  insert(values: unknown): HrQueryBuilder<T>;
  upsert(values: unknown, options?: Record<string, unknown>): HrQueryBuilder<T>;
  update(values: unknown): HrQueryBuilder<T>;
  eq(column: string, value: unknown): HrQueryBuilder<T>;
  neq(column: string, value: unknown): HrQueryBuilder<T>;
  gte(column: string, value: unknown): HrQueryBuilder<T>;
  lte(column: string, value: unknown): HrQueryBuilder<T>;
  order(column: string, options?: Record<string, unknown>): HrQueryBuilder<T>;
  limit(count: number): HrQueryBuilder<T>;
};
type HrSupabaseClient = {
  from(table: string): HrQueryBuilder;
};
type HrSupabaseRpcClient = {
  rpc(functionName: string, args?: Record<string, unknown>): Promise<SupabaseResult>;
};

const toTypedArray = <T>(data: unknown): T[] => (Array.isArray(data) ? (data as T[]) : []);
const fromHrTable = (table: string) => (supabase as unknown as HrSupabaseClient).from(table);

export function useMyHrProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-hr-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single();
      if (error) throw error;
      return data as HrProfile;
    },
    enabled: !!user,
  });
}

export function useProfileChangeRequests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['my-profile-change-requests', user?.id],
    queryFn: async () => {
      const { data, error } = await fromHrTable('profile_change_requests')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return toTypedArray<ProfileChangeRequest>(data);
    },
    enabled: !!user,
  });

  const createRequest = useMutation({
    mutationFn: async (changes: Record<string, unknown>) => {
      const { error } = await fromHrTable('profile_change_requests').insert({
        user_id: user!.id,
        requested_by: user!.id,
        changes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-profile-change-requests', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['profile-change-review-queue'] });
    },
  });

  const cancelRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await fromHrTable('profile_change_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId)
        .eq('user_id', user!.id)
        .eq('status', 'pending');
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-profile-change-requests', user?.id] }),
  });

  return { ...query, createRequest, cancelRequest };
}

export function useProfileChangeReviewQueue(enabled: boolean) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['profile-change-review-queue'],
    queryFn: async () => {
      const { data, error } = await fromHrTable('profile_change_requests')
        .select('*, profile:user_id(full_name,email,department,position)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return toTypedArray<ProfileChangeRequest>(data);
    },
    enabled,
  });

  const reviewRequest = useMutation({
    mutationFn: async ({
      requestId,
      status,
      comment,
    }: {
      requestId: string;
      status: Extract<ProfileChangeStatus, 'approved' | 'rejected'>;
      comment?: string;
    }) => {
      const { error } = await fromHrTable('profile_change_requests')
        .update({
          status,
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
          review_comment: comment || null,
        })
        .eq('id', requestId)
        .eq('status', 'pending');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-change-review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['my-profile-change-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-hr-profile'] });
    },
  });

  return { ...query, reviewRequest };
}

export function useHrRequests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['my-hr-requests', user?.id],
    queryFn: async () => {
      const { data, error } = await fromHrTable('hr_requests')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return toTypedArray<HrRequest>(data);
    },
    enabled: !!user,
  });

  const createRequest = useMutation({
    mutationFn: async (payload: { request_type: string; payload: Record<string, unknown> }) => {
      const { error } = await fromHrTable('hr_requests').insert({
        user_id: user!.id,
        request_type: payload.request_type,
        payload: payload.payload,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-hr-requests', user?.id] }),
  });

  const cancelRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await fromHrTable('hr_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId)
        .eq('user_id', user!.id)
        .eq('status', 'pending');
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-hr-requests', user?.id] }),
  });

  return { ...query, createRequest, cancelRequest };
}

export function usePayStatements() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['my-pay-statements', user?.id],
    queryFn: async () => {
      const { data, error } = await fromHrTable('pay_statements')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'published')
        .order('pay_month', { ascending: false })
        .limit(24);
      if (error) throw error;
      return toTypedArray<PayStatement>(data);
    },
    enabled: !!user,
  });

  const recordEvent = useMutation({
    mutationFn: async ({ statementId, eventType }: { statementId: string; eventType: 'viewed' | 'downloaded' }) => {
      const { error } = await (supabase as unknown as HrSupabaseRpcClient).rpc('record_pay_statement_event', {
        p_statement_id: statementId,
        p_event_type: eventType,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-pay-statements', user?.id] }),
  });

  return { ...query, recordEvent };
}

export type PayStatementSaveInput = {
  id?: string;
  user_id: string;
  pay_month: string;
  pay_period_start: string;
  pay_period_end: string;
  payment_date: string;
  earnings: PayStatementLineItem[];
  deductions: PayStatementLineItem[];
  memo?: string | null;
  internal_note?: string | null;
  file_storage_path?: string | null;
  status: PayStatementStatus;
  calculation_run_id?: string | null;
  rate_version_id?: string | null;
  calculation_basis?: Record<string, unknown>;
  has_manual_override?: boolean;
  calculation_input_snapshot?: Record<string, unknown>;
  calculation_result_snapshot?: Record<string, unknown>;
  calculation_warnings?: string[];
};

export function usePayrollProfiles(enabled: boolean) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['employee-payroll-profiles'],
    queryFn: async () => {
      const { data, error } = await fromHrTable('employee_payroll_profiles')
        .select('*')
        .order('effective_from', { ascending: false });
      if (error) throw error;
      return toTypedArray<PayrollProfile>(data);
    },
    enabled: enabled && !!user,
  });

  const saveProfile = useMutation({
    mutationFn: async (profile: PayrollProfile) => {
      const payload = {
        ...profile,
        monthly_base_pay: Math.max(0, Math.round(Number(profile.monthly_base_pay) || 0)),
        annual_salary: Math.max(0, Math.round(Number(profile.annual_salary) || 0)),
        hourly_wage: Math.max(0, Math.round(Number(profile.hourly_wage) || 0)),
        standard_monthly_hours: Math.max(1, Number(profile.standard_monthly_hours) || 209),
        non_taxable_allowances: profile.non_taxable_allowances || [],
        fixed_allowances: profile.fixed_allowances || [],
        overtime_policy: profile.overtime_policy || {},
        deduction_settings: profile.deduction_settings || {},
        effective_from: profile.effective_from || new Date().toISOString().slice(0, 10),
        status: profile.status || 'active',
        updated_by: user!.id,
        ...(profile.id ? {} : { created_by: user!.id }),
      };
      const queryBuilder = profile.id
        ? fromHrTable('employee_payroll_profiles').update(payload).eq('id', profile.id)
        : fromHrTable('employee_payroll_profiles').insert(payload);
      const { data, error } = await queryBuilder.select('*');
      if (error) throw error;
      await fromHrTable('pay_statement_events').insert({
        pay_statement_id: null,
        user_id: profile.user_id,
        actor_id: user!.id,
        event_type: 'payroll_profile_updated',
        metadata: { source: 'admin_panel' },
      });
      return Array.isArray(data) ? data[0] : data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employee-payroll-profiles'] }),
  });

  return { ...query, saveProfile };
}

export function usePayrollRateVersions(enabled: boolean) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['payroll-rate-versions'],
    queryFn: async () => {
      const { data, error } = await fromHrTable('payroll_rate_versions')
        .select('*')
        .order('effective_from', { ascending: false });
      if (error) throw error;
      return toTypedArray<PayrollRateVersion>(data);
    },
    enabled: enabled && !!user,
  });

  const saveRateVersion = useMutation({
    mutationFn: async (rate: PayrollRateVersion) => {
      const payload = {
        ...rate,
        national_pension_rate: Math.max(0, Number(rate.national_pension_rate) || 0),
        health_insurance_rate: Math.max(0, Number(rate.health_insurance_rate) || 0),
        long_term_care_rate: Math.max(0, Number(rate.long_term_care_rate) || 0),
        employment_insurance_rate: Math.max(0, Number(rate.employment_insurance_rate) || 0),
        local_income_tax_rate: Math.max(0, Number(rate.local_income_tax_rate) || 0),
        income_tax_config: rate.income_tax_config || {},
        updated_by: user!.id,
        ...(rate.id ? {} : { created_by: user!.id }),
      };

      if (payload.is_active) {
        const { error: deactivateError } = await fromHrTable('payroll_rate_versions')
          .update({ is_active: false, updated_by: user!.id })
          .neq('id', rate.id || '');
        if (deactivateError) throw deactivateError;
      }

      const queryBuilder = rate.id
        ? fromHrTable('payroll_rate_versions').update(payload).eq('id', rate.id)
        : fromHrTable('payroll_rate_versions').insert(payload);
      const { data, error } = await queryBuilder.select('*');
      if (error) throw error;
      await fromHrTable('pay_statement_events').insert({
        pay_statement_id: null,
        user_id: null,
        actor_id: user!.id,
        event_type: 'payroll_rate_updated',
        metadata: { source: 'admin_panel', name: rate.name },
      });
      return Array.isArray(data) ? data[0] : data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll-rate-versions'] }),
  });

  return { ...query, saveRateVersion };
}

export function usePayrollAttendanceRecords(userId: string | null, payPeriodStart: string | null, payPeriodEnd: string | null) {
  return useQuery({
    queryKey: ['payroll-attendance-records', userId, payPeriodStart, payPeriodEnd],
    queryFn: async () => {
      const { data, error } = await fromHrTable('attendance_records')
        .select('date,check_in,check_out,work_hours,status')
        .eq('user_id', userId!)
        .gte('date', payPeriodStart!)
        .lte('date', payPeriodEnd!)
        .order('date', { ascending: true });
      if (error) throw error;
      return toTypedArray<PayrollAttendanceRecord>(data);
    },
    enabled: !!userId && !!payPeriodStart && !!payPeriodEnd,
  });
}

const sumLineItems = (items: PayStatementLineItem[]) =>
  items.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);

const normalizeLineItems = (items: PayStatementLineItem[]) =>
  items
    .map((item) => ({
      id: item.id || crypto.randomUUID(),
      label: item.label.trim(),
      amount: Math.max(0, Math.round(Number(item.amount) || 0)),
      note: item.note?.trim() || undefined,
      source: item.source === 'manual' ? 'manual' : 'auto',
      taxable: item.taxable === false ? false : true,
      formula_key: item.formula_key,
    }))
    .filter((item) => item.label && item.amount >= 0);

export function useAdminPayStatements(enabled: boolean) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin-pay-statements'],
    queryFn: async () => {
      const { data, error } = await fromHrTable('pay_statements')
        .select('*, profile:user_id(full_name,email,department,position,employee_number)')
        .order('pay_month', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return toTypedArray<PayStatement>(data);
    },
    enabled: enabled && !!user,
  });

  const saveStatement = useMutation({
    mutationFn: async (input: PayStatementSaveInput) => {
      const earnings = normalizeLineItems(input.earnings);
      const deductions = normalizeLineItems(input.deductions);
      const grossPay = sumLineItems(earnings);
      const totalDeductions = sumLineItems(deductions);
      const netPay = grossPay - totalDeductions;
      if (netPay < 0) throw new Error('공제 합계가 지급 합계보다 클 수 없습니다.');

      const now = new Date().toISOString();
      const payload = {
        user_id: input.user_id,
        pay_month: input.pay_month,
        pay_period_start: input.pay_period_start,
        pay_period_end: input.pay_period_end,
        payment_date: input.payment_date,
        earnings,
        deductions,
        gross_pay: grossPay,
        total_deductions: totalDeductions,
        net_pay: netPay,
        memo: input.memo || null,
        internal_note: input.internal_note || null,
        file_storage_path: input.file_storage_path || null,
        calculation_run_id: input.calculation_run_id || null,
        rate_version_id: input.rate_version_id || null,
        calculation_basis: input.calculation_basis || {},
        has_manual_override: Boolean(input.has_manual_override),
        status: input.status,
        published_at: input.status === 'published' ? now : null,
        issued_at: input.status === 'published' ? now : null,
        issued_by: input.status === 'published' ? user!.id : null,
        voided_at: null,
        voided_by: null,
        void_reason: null,
      };

      const queryBuilder = input.id
        ? fromHrTable('pay_statements').update(payload).eq('id', input.id)
        : fromHrTable('pay_statements').upsert(payload, { onConflict: 'user_id,pay_month' });

      const { data, error } = await queryBuilder.select('*');
      if (error) throw error;
      const saved = Array.isArray(data) ? data[0] as PayStatement | undefined : data as PayStatement | undefined;
      const statementId = saved?.id || input.id;
      let calculationRunId = input.calculation_run_id || null;
      if (statementId && input.calculation_result_snapshot) {
        const { data: runData, error: runError } = await fromHrTable('payroll_calculation_runs').insert({
          user_id: input.user_id,
          pay_statement_id: statementId,
          pay_month: input.pay_month,
          rate_version_id: input.rate_version_id || null,
          input_snapshot: input.calculation_input_snapshot || {},
          result_snapshot: input.calculation_result_snapshot,
          warnings: input.calculation_warnings || [],
          created_by: user!.id,
        }).select('*');
        if (runError) throw runError;
        const run = Array.isArray(runData) ? runData[0] as { id?: string } | undefined : runData as { id?: string } | undefined;
        calculationRunId = run?.id || null;
        if (calculationRunId) {
          const { error: updateRunError } = await fromHrTable('pay_statements')
            .update({ calculation_run_id: calculationRunId })
            .eq('id', statementId);
          if (updateRunError) throw updateRunError;
        }
      }
      if (statementId) {
        await fromHrTable('pay_statement_events').insert({
          pay_statement_id: statementId,
          user_id: input.user_id,
          actor_id: user!.id,
          event_type: input.status === 'published' ? 'published' : input.id ? 'updated' : 'created',
          metadata: {
            source: 'admin_panel',
            pay_month: input.pay_month,
            calculation_run_id: calculationRunId,
            has_manual_override: Boolean(input.has_manual_override),
          },
        });
      }
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pay-statements'] });
      queryClient.invalidateQueries({ queryKey: ['my-pay-statements'] });
    },
  });

  const voidStatement = useMutation({
    mutationFn: async ({ statementId, reason }: { statementId: string; reason: string }) => {
      const now = new Date().toISOString();
      const { data, error } = await fromHrTable('pay_statements')
        .update({
          status: 'voided',
          voided_at: now,
          voided_by: user!.id,
          void_reason: reason || '관리자 회수',
        })
        .eq('id', statementId)
        .select('*');
      if (error) throw error;
      const statement = Array.isArray(data) ? data[0] as PayStatement | undefined : data as PayStatement | undefined;
      await fromHrTable('pay_statement_events').insert({
        pay_statement_id: statementId,
        user_id: statement?.user_id || null,
        actor_id: user!.id,
        event_type: 'voided',
        metadata: { source: 'admin_panel', reason },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pay-statements'] });
      queryClient.invalidateQueries({ queryKey: ['my-pay-statements'] });
    },
  });

  return { ...query, saveStatement, voidStatement };
}

export function useEmployeeHrTasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['my-employee-hr-tasks', user?.id],
    queryFn: async () => {
      const { data, error } = await fromHrTable('employee_hr_tasks')
        .select('*')
        .eq('user_id', user!.id)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return toTypedArray<EmployeeHrTask>(data);
    },
    enabled: !!user,
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: HrTaskStatus }) => {
      const updates: Record<string, unknown> = { status };
      if (status === 'completed') updates.completed_at = new Date().toISOString();
      if (status !== 'completed') updates.completed_at = null;
      const { error } = await fromHrTable('employee_hr_tasks')
        .update(updates)
        .eq('id', taskId)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-employee-hr-tasks', user?.id] }),
  });

  return { ...query, updateTaskStatus };
}
