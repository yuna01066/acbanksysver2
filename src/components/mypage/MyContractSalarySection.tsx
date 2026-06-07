import React, { useCallback, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Download, Eye, FileQuestion, Loader2, MessageSquareText, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import MyContractsList from '@/components/contract/MyContractsList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { getDownloadUrl } from '@/services/documentFiles';
import { useHrRequests, usePayStatements, type PayStatement } from '@/hooks/useHrSelfService';
import { MyPageEmptyState, MyPageSectionHeader } from '@/components/mypage/MyPageLayout';
import MyPayStatementDetailDialog from '@/components/payroll/MyPayStatementDetailDialog';

const hrRequestTypeLabels: Record<string, string> = {
  employment_certificate: '재직증명서',
  career_certificate: '경력증명서',
  salary_question: '급여 문의',
  other: '기타 HR 요청',
};

const hrRequestStatusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: '접수', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  in_progress: { label: '처리중', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  completed: { label: '완료', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  rejected: { label: '반려', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  cancelled: { label: '취소', className: 'bg-muted text-muted-foreground' },
};

const formatAmount = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-';
  return `${Number(value).toLocaleString()}원`;
};

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : '';

const MyContractSalarySection: React.FC = () => {
  const { data: payStatements = [], isLoading: payLoading, recordEvent } = usePayStatements();
  const { data: hrRequests = [], isLoading: requestLoading, createRequest, cancelRequest } = useHrRequests();
  const [requestType, setRequestType] = useState('employment_certificate');
  const [requestTitle, setRequestTitle] = useState('');
  const [requestDetail, setRequestDetail] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [selectedStatement, setSelectedStatement] = useState<PayStatement | null>(null);
  const handleRecordPayEvent = useCallback((statementId: string, eventType: 'viewed' | 'downloaded') => {
    recordEvent.mutate({ statementId, eventType });
  }, [recordEvent]);

  const openPayFile = async (storagePath: string) => {
    try {
      const url = await getDownloadUrl({
        storageProvider: 'supabase_storage',
        storageBucket: 'pay-statements',
        storagePath,
      });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error: unknown) {
      toast.error('급여명세 파일을 열 수 없습니다: ' + getErrorMessage(error));
    }
  };

  const submitHrRequest = async () => {
    if (!requestDetail.trim()) {
      toast.warning('요청 내용을 입력해주세요.');
      return;
    }

    try {
      await createRequest.mutateAsync({
        request_type: requestType,
        payload: {
          title: requestTitle.trim() || hrRequestTypeLabels[requestType],
          detail: requestDetail.trim(),
          needed_by: neededBy || null,
        },
      });
      toast.success('HR 요청이 접수되었습니다.');
      setRequestTitle('');
      setRequestDetail('');
      setNeededBy('');
    } catch (error: unknown) {
      toast.error('요청 접수 실패: ' + getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-5">
      <MyPageSectionHeader
        title="계약·급여"
        description="전자계약 서명, 급여명세 확인, 증명서·급여 문의 요청을 처리합니다."
        icon={<Wallet className="h-4 w-4" />}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <MyContractsList />

          <Card className="border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4 text-primary" />
                급여명세
              </CardTitle>
              <CardDescription>관리자가 게시한 월별 급여명세를 확인합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {payLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : payStatements.length === 0 ? (
                <MyPageEmptyState title="게시된 급여명세가 없습니다." description="급여명세가 게시되면 이곳에서 확인할 수 있습니다." />
              ) : (
                payStatements.map((statement) => (
                  <div key={statement.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {format(new Date(statement.pay_month), 'yyyy년 M월 급여', { locale: ko })}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        총지급 {formatAmount(statement.gross_pay)} · 공제 {formatAmount(statement.total_deductions)} · 실지급 {formatAmount(statement.net_pay)}
                      </p>
                      {statement.published_at && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          게시일 {format(new Date(statement.published_at), 'yyyy.MM.dd', { locale: ko })}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSelectedStatement(statement)}>
                        <Eye className="h-3.5 w-3.5" />
                        상세 보기
                      </Button>
                      {statement.file_storage_path && (
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openPayFile(statement.file_storage_path!)}>
                          <Download className="h-3.5 w-3.5" />
                          파일 열기
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileQuestion className="h-4 w-4 text-primary" />
                HR 요청
              </CardTitle>
              <CardDescription>증명서 발급, 급여 문의 등 인사팀 처리가 필요한 요청을 남깁니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>요청 유형</Label>
                <Select value={requestType} onValueChange={setRequestType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(hrRequestTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>제목</Label>
                <Input value={requestTitle} onChange={(event) => setRequestTitle(event.target.value)} placeholder="선택 입력" />
              </div>
              <div className="space-y-1.5">
                <Label>필요일</Label>
                <Input type="date" value={neededBy} onChange={(event) => setNeededBy(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>요청 내용</Label>
                <Textarea value={requestDetail} onChange={(event) => setRequestDetail(event.target.value)} rows={5} placeholder="용도, 제출처, 필요한 내용 등을 입력하세요." />
              </div>
              <Button className="w-full" onClick={submitHrRequest} disabled={createRequest.isPending}>
                {createRequest.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <MessageSquareText className="mr-1.5 h-3.5 w-3.5" />}
                요청 접수
              </Button>
            </CardContent>
          </Card>

          <Card className="border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">내 요청 내역</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {requestLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : hrRequests.length === 0 ? (
                <MyPageEmptyState title="접수된 HR 요청이 없습니다." description="증명서 발급이나 급여 문의가 필요하면 위에서 요청하세요." />
              ) : (
                hrRequests.slice(0, 8).map((request) => {
                  const status = hrRequestStatusLabels[request.status] || hrRequestStatusLabels.pending;
                  return (
                    <div key={request.id} className="rounded-lg border p-3">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {String(request.payload?.title || hrRequestTypeLabels[request.request_type] || request.request_type)}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {format(new Date(request.created_at), 'yyyy.MM.dd HH:mm', { locale: ko })}
                          </p>
                        </div>
                        <Badge className={status.className}>{status.label}</Badge>
                      </div>
                      {request.payload?.detail && (
                        <p className="line-clamp-3 text-xs text-muted-foreground">{String(request.payload.detail)}</p>
                      )}
                      {request.admin_comment && (
                        <>
                          <Separator className="my-2" />
                          <p className="text-xs text-foreground">답변: {request.admin_comment}</p>
                        </>
                      )}
                      {request.status === 'pending' && (
                        <Button variant="ghost" size="sm" className="mt-2 h-8 px-0 text-xs text-muted-foreground" onClick={() => cancelRequest.mutate(request.id)}>
                          요청 취소
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <MyPayStatementDetailDialog
        statement={selectedStatement}
        open={Boolean(selectedStatement)}
        onOpenChange={(open) => !open && setSelectedStatement(null)}
        onRecordEvent={handleRecordPayEvent}
      />
    </div>
  );
};

export default MyContractSalarySection;
