import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BrandedCardHeader } from '@/components/ui/branded-card-header';
import {
  EMPLOYEE_WORK_STATUS_CONFIG,
  EmployeeWorkStatus,
  getStoredEmployeeWorkStatus,
  setStoredEmployeeWorkStatus,
} from '@/components/EmployeeOnlineHeartbeat';
import { cn } from '@/lib/utils';

type AttendanceStatus = 'checked_in' | 'not_checked_in' | 'checked_out';

export type OnlineEmployee = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  department: string | null;
  position: string | null;
  work_status: EmployeeWorkStatus | null;
  last_seen_at: string;
  attendance_status: AttendanceStatus;
  check_in: string | null;
  check_out: string | null;
};

export type OnlineEmployeeCounts = {
  total: number;
  checked_in: number;
  not_checked_in: number;
  checked_out: number;
};

const ATTENDANCE_STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; ringClassName: string; badgeClassName: string; sort: number }
> = {
  checked_in: {
    label: '출근중',
    ringClassName: 'ring-2 ring-emerald-200 border-emerald-400',
    badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    sort: 0,
  },
  not_checked_in: {
    label: '미출근',
    ringClassName: 'ring-2 ring-rose-200 border-rose-400',
    badgeClassName: 'border-rose-200 bg-rose-50 text-rose-700',
    sort: 1,
  },
  checked_out: {
    label: '퇴근완료',
    ringClassName: 'ring-2 ring-slate-200 border-slate-300',
    badgeClassName: 'border-slate-200 bg-slate-50 text-slate-600',
    sort: 2,
  },
};

function getInitials(name?: string | null) {
  const trimmed = name?.trim();
  if (!trimmed) return '?';
  return trimmed.slice(0, 2).toUpperCase();
}

function formatLastSeen(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 60_000) return '방금 전';
  const minutes = Math.floor(diffMs / 60_000);
  return `${minutes}분 전`;
}

export function useAdminOnlineUsers(enabled = true) {
  const { user, isAdmin, isModerator } = useAuth();
  const queryClient = useQueryClient();
  const canView = isAdmin || isModerator;

  const query = useQuery({
    queryKey: ['employee-online-status'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_employee_online_status' as any);
      if (error) throw error;
      return (data || []) as OnlineEmployee[];
    },
    enabled: !!user && canView && enabled,
    refetchInterval: 30_000,
  });

  const onlineEmployees = query.data || [];

  const updateStatusMutation = useMutation({
    mutationFn: async (status: EmployeeWorkStatus) => {
      setStoredEmployeeWorkStatus(status);
      const { error } = await supabase.rpc('upsert_employee_online_heartbeat' as any, {
        _work_status: status,
        _user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ['employee-online-status'] });
      toast.success(`내 업무 상태가 "${EMPLOYEE_WORK_STATUS_CONFIG[status].label}"(으)로 변경되었습니다.`);
    },
    onError: (error: any) => {
      toast.error(`업무 상태 변경 실패: ${error?.message || '알 수 없는 오류'}`);
    },
  });

  const sortedEmployees = useMemo(() => {
    return [...onlineEmployees].sort((a, b) => {
      if (a.user_id === user?.id) return -1;
      if (b.user_id === user?.id) return 1;

      const attendanceDelta =
        ATTENDANCE_STATUS_CONFIG[a.attendance_status]?.sort -
        ATTENDANCE_STATUS_CONFIG[b.attendance_status]?.sort;
      if (attendanceDelta !== 0) return attendanceDelta;

      return (a.full_name || '').localeCompare(b.full_name || '', 'ko');
    });
  }, [onlineEmployees, user?.id]);

  const counts = useMemo<OnlineEmployeeCounts>(() => {
    return onlineEmployees.reduce(
      (acc, employee) => {
        acc.total += 1;
        acc[employee.attendance_status] += 1;
        return acc;
      },
      { total: 0, checked_in: 0, not_checked_in: 0, checked_out: 0 }
    );
  }, [onlineEmployees]);

  return {
    ...query,
    canView,
    counts,
    onlineEmployees,
    sortedEmployees,
    updateStatusMutation,
    currentUserId: user?.id,
  };
}

type AdminOnlineUsersPanelProps = {
  showHeader?: boolean;
  className?: string;
};

const AdminOnlineUsersPanel = ({ showHeader = true, className }: AdminOnlineUsersPanelProps) => {
  const {
    canView,
    counts,
    currentUserId,
    isError,
    isLoading,
    sortedEmployees,
    updateStatusMutation,
  } = useAdminOnlineUsers();

  if (!canView) return null;

  return (
    <div className={cn('flex min-h-[260px] flex-col', className)}>
      {showHeader && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <BrandedCardHeader
            icon={Radio}
            title="현재 접속 중"
            subtitle="최근 2분 내 앱 접속자"
            iconClassName="text-slate-700"
            iconWrapClassName="border-slate-200 bg-slate-100"
          />
          <Select
            defaultValue={getStoredEmployeeWorkStatus()}
            onValueChange={(value) => updateStatusMutation.mutate(value as EmployeeWorkStatus)}
            disabled={updateStatusMutation.isPending}
          >
            <SelectTrigger className="h-8 w-[108px] shrink-0 rounded-full text-xs">
              <SelectValue placeholder="내 상태" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(EMPLOYEE_WORK_STATUS_CONFIG) as EmployeeWorkStatus[]).map((status) => (
                <SelectItem key={status} value={status}>
                  {EMPLOYEE_WORK_STATUS_CONFIG[status].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-1.5">
        <Badge variant="outline" className="rounded-full bg-background px-2.5">접속 {counts.total}명</Badge>
        <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-2.5 text-emerald-700">출근중 {counts.checked_in}</Badge>
        <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 px-2.5 text-rose-700">미출근 {counts.not_checked_in}</Badge>
        <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-2.5 text-slate-600">퇴근완료 {counts.checked_out}</Badge>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 text-center text-sm text-muted-foreground">
          접속자 정보를 불러오지 못했습니다.
        </div>
      ) : sortedEmployees.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 text-center text-sm text-muted-foreground">
          현재 접속 중인 직원이 없습니다.
        </div>
      ) : (
        <div className="grid max-h-[58vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {sortedEmployees.map((employee) => {
            const attendance = ATTENDANCE_STATUS_CONFIG[employee.attendance_status];
            const workStatus = employee.work_status || 'available';
            const workConfig = EMPLOYEE_WORK_STATUS_CONFIG[workStatus];
            const isMe = employee.user_id === currentUserId;

            return (
              <div key={employee.user_id} className="rounded-lg border border-border/70 bg-background/80 p-2.5">
                <div className="flex items-center gap-2.5">
                  <Avatar className={cn('h-10 w-10 shrink-0 border bg-muted', attendance.ringClassName)}>
                    <AvatarImage src={employee.avatar_url || undefined} alt={employee.full_name || ''} className="object-cover" />
                    <AvatarFallback className="text-xs">{getInitials(employee.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {employee.full_name || '이름 없음'}
                      </p>
                      {isMe && <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px]">나</Badge>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {[employee.department, employee.position].filter(Boolean).join(' · ') || '부서 미지정'}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className={cn('h-2 w-2 rounded-full', workConfig.dotClassName)} />
                    <span className={cn('font-medium', workConfig.textClassName)}>{workConfig.label}</span>
                    <span className="text-muted-foreground">{formatLastSeen(employee.last_seen_at)}</span>
                  </div>
                  <Badge variant="outline" className={cn('h-6 rounded-full px-2 text-[11px]', attendance.badgeClassName)}>
                    {attendance.label}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminOnlineUsersPanel;
