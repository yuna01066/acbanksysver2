import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ProfileChangeStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type HrRequestStatus = 'pending' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';
export type HrTaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

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
  gross_pay: number | null;
  deductions: Record<string, unknown>;
  net_pay: number | null;
  file_storage_path: string | null;
  published_at: string | null;
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
  update(values: unknown): HrQueryBuilder<T>;
  eq(column: string, value: unknown): HrQueryBuilder<T>;
  order(column: string, options?: Record<string, unknown>): HrQueryBuilder<T>;
  limit(count: number): HrQueryBuilder<T>;
};
type HrSupabaseClient = {
  from(table: string): HrQueryBuilder;
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

  return useQuery({
    queryKey: ['my-pay-statements', user?.id],
    queryFn: async () => {
      const { data, error } = await fromHrTable('pay_statements')
        .select('*')
        .eq('user_id', user!.id)
        .order('pay_month', { ascending: false })
        .limit(24);
      if (error) throw error;
      return toTypedArray<PayStatement>(data);
    },
    enabled: !!user,
  });
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
