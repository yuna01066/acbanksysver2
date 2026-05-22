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

function statusBadgeClass(status: string) {
  if (status === 'pending') return 'border-amber-300 text-amber-700';
  if (status === 'applied' || status === 'approved') return 'border-emerald-300 text-emerald-700';
  if (status === 'rejected') return 'border-red-300 text-red-700';
  return '';
}

const SettingsChangeRequestsPanel: React.FC = () => {
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
    <Card className="border-white/60 bg-card/80">
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              설정 변경 승인 요청
            </CardTitle>
            <CardDescription>
              중간관리자가 요청한 고위험 설정 변경을 관리자가 검토하고 반영합니다.
            </CardDescription>
          </div>
          <Badge variant={pendingCount > 0 ? 'destructive' : 'secondary'} className="w-fit">
            대기 {pendingCount}건
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-28 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            등록된 설정 변경 요청이 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => {
              const isPending = request.status === 'pending';
              const processing = approveMutation.isPending || rejectMutation.isPending;

              return (
                <div key={request.id} className="rounded-xl border bg-background p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={statusBadgeClass(request.status)}>
                          {STATUS_LABELS[request.status] || request.status}
                        </Badge>
                        <Badge variant={request.risk_level === 'high' ? 'destructive' : 'secondary'}>
                          위험도 {RISK_LABELS[request.risk_level] || request.risk_level}
                        </Badge>
                        <Badge variant="outline">{request.target_table}</Badge>
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
                      <div className="w-full space-y-2 lg:w-80">
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
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SettingsChangeRequestsPanel;
