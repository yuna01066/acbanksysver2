import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  approveSettingsChangeRequest,
  listSettingsChangeRequests,
  rejectSettingsChangeRequest,
  type SettingsChangeRequestRecord,
} from '@/services/settingsChangeRequests';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<string, string> = {
  pending: '승인 대기',
  approved: '승인됨',
  rejected: '거부됨',
  applied: '반영됨',
  cancelled: '취소됨',
};

const RISK_LABELS: Record<string, string> = {
  low: '낮음',
  medium: '중간',
  high: '높음',
};

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type SettingsChangeRequestsPanelProps = {
  variant?: 'compact' | 'full';
  maxItems?: number;
};

function statusBadgeClass(status: string) {
  if (status === 'pending') return 'border-amber-300 text-amber-700';
  if (status === 'applied' || status === 'approved') return 'border-emerald-300 text-emerald-700';
  if (status === 'rejected') return 'border-red-300 text-red-700';
  return '';
}

const SettingsChangeRequestsPanel: React.FC<SettingsChangeRequestsPanelProps> = ({
  variant = 'full',
  maxItems,
}) => {
  const queryClient = useQueryClient();
  const { isAdmin, isModerator } = useAuth();
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const { data: requests = [], isLoading } = useQuery<SettingsChangeRequestRecord[]>({
    queryKey: ['settings-change-requests'],
    queryFn: listSettingsChangeRequests,
    enabled: isAdmin || isModerator,
  });

  const pendingCount = useMemo(
    () => requests.filter((request) => request.status === 'pending').length,
    [requests],
  );
  const visibleRequests = useMemo(
    () => requests.slice(0, maxItems ?? requests.length),
    [maxItems, requests],
  );
  const isCompact = variant === 'compact';

  const approveMutation = useMutation({
    mutationFn: async (request: SettingsChangeRequestRecord) => {
      await approveSettingsChangeRequest(request.id, reviewNotes[request.id]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-change-requests'] });
      queryClient.invalidateQueries({ queryKey: ['response-assistant-setting'] });
      toast.success('승인 요청이 반영되었습니다.');
    },
    onError: (error: Error) => toast.error('승인 실패: ' + error.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async (request: SettingsChangeRequestRecord) => {
      await rejectSettingsChangeRequest(request.id, reviewNotes[request.id]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-change-requests'] });
      toast.success('승인 요청이 거부되었습니다.');
    },
    onError: (error: Error) => toast.error('거부 실패: ' + error.message),
  });

  if (!isAdmin && !isModerator) return null;

  return (
    <Card className={cn('border-border bg-white shadow-none', isCompact && 'rounded-lg')}>
      <CardHeader className={cn(isCompact && 'p-4 pb-3')}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-foreground" />
              설정 변경 승인 요청
            </CardTitle>
            <CardDescription className={cn(isCompact && 'text-xs')}>
              {isCompact
                ? '대기 중인 고위험 설정 변경을 빠르게 확인합니다.'
                : '중간관리자가 요청한 고위험 설정 변경을 관리자가 검토하고 반영합니다.'}
            </CardDescription>
          </div>
          <Badge variant={pendingCount > 0 ? 'destructive' : 'secondary'} className="w-fit rounded-full">
            대기 {pendingCount}건
          </Badge>
        </div>
      </CardHeader>
      <CardContent className={cn(isCompact && 'p-4 pt-0')}>
        {isLoading ? (
          <div className={cn('flex items-center justify-center', isCompact ? 'h-20' : 'h-28')}>
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <div className={cn('rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground', isCompact && 'p-4 text-xs')}>
            등록된 설정 변경 요청이 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleRequests.map((request) => {
              const isPending = request.status === 'pending';
              const processing = approveMutation.isPending || rejectMutation.isPending;

              return (
                <div key={request.id} className={cn('rounded-lg border bg-background p-4', isCompact && 'p-3')}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cn('rounded-full', statusBadgeClass(request.status))}>
                          {STATUS_LABELS[request.status] || request.status}
                        </Badge>
                        <Badge variant={request.risk_level === 'high' ? 'destructive' : 'secondary'} className="rounded-full">
                          위험도 {RISK_LABELS[request.risk_level] || request.risk_level}
                        </Badge>
                        <Badge variant="outline" className="rounded-full">{request.target_table}</Badge>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{request.change_summary}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          키: {request.target_key} · 요청자: {request.requested_by_name || request.requested_by} · {formatDateTime(request.created_at)}
                        </p>
                        {request.applied_at && (
                          <p className="mt-1 text-xs text-emerald-700">
                            반영 완료: {formatDateTime(request.applied_at)}
                          </p>
                        )}
                      </div>
                    </div>
                    {isPending && isAdmin && (
                      <div className={cn('w-full space-y-2', isCompact ? 'lg:w-64' : 'lg:w-80')}>
                        <Textarea
                          value={reviewNotes[request.id] || ''}
                          onChange={(event) => setReviewNotes((current) => ({ ...current, [request.id]: event.target.value }))}
                          placeholder="승인/거부 메모"
                          className="min-h-16 text-xs"
                        />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Button
                            size="sm"
                            onClick={() => approveMutation.mutate(request)}
                            disabled={processing}
                            className="gap-1.5"
                          >
                            {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            승인 반영
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => rejectMutation.mutate(request)}
                            disabled={processing}
                            className="gap-1.5"
                          >
                            <XCircle className="h-4 w-4" />
                            거부
                          </Button>
                        </div>
                      </div>
                    )}
                    {isPending && !isAdmin && (
                      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                        <Clock3 className="h-4 w-4" />
                        관리자 승인 대기 중
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {maxItems && requests.length > maxItems && (
              <div className="rounded-lg border border-dashed px-3 py-2 text-center text-xs text-muted-foreground">
                외 {requests.length - maxItems}건은 전체 검토에서 확인할 수 있습니다.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SettingsChangeRequestsPanel;
