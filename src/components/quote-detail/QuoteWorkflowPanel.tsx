import { useState } from 'react';
import { Copy, ExternalLink, FolderOpen, Loader2, PlusCircle, RotateCcw, UserCheck, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import ProjectStageSelect from '@/components/ProjectStageSelect';
import QuoteAssigneeSelect, { type QuoteAssigneeOption } from '@/components/QuoteAssigneeSelect';
import QuoteLostReasonDialog, { type QuoteLostReasonFormValue } from '@/components/quote/QuoteLostReasonDialog';
import { getStageInfo, normalizeProjectStage } from '@/utils/quoteWorkflow';
import { canRecordQuoteLostReason, getQuoteLostByLabel, getQuoteLostReasonLabel } from '@/utils/quoteLossReason';
import { supabase } from '@/integrations/supabase/client';
import { getApprovalStatusClass, getApprovalStatusLabel } from '@/services/approvalRequests';

interface LinkedProject {
  id: string;
  name: string;
  payment_status: string | null;
}

interface QuoteWorkflowPanelProps {
  quoteId: string;
  quoteNumber: string;
  quoteTitle?: string | null;
  quoteRecipient?: string | null;
  quoteTotal?: number | null;
  projectStage?: string | null;
  quoteUserId?: string | null;
  quoteStatus?: string | null;
  assignedTo?: string | null;
  assignedToName?: string | null;
  users: QuoteAssigneeOption[];
  linkedProject: LinkedProject | null;
  lostReasonCategory?: string | null;
  lostReasonDetail?: string | null;
  lostBy?: string | null;
  lostRecordedAt?: string | null;
  projectFollowupStatus?: string | null;
  projectFollowupNote?: string | null;
  projectFollowupUpdatedAt?: string | null;
  convertingProject?: boolean;
  projectFollowupUpdating?: boolean;
  isExpired?: boolean;
  canReissue?: boolean;
  reissuingQuote?: boolean;
  duplicatingQuote?: boolean;
  reissuedQuoteId?: string | null;
  reissuedFromQuoteId?: string | null;
  onStageChanged: (stage: string) => void;
  onAssigneeChanged: (assigneeId: string | null, assigneeName: string | null) => void;
  onConvertProject: () => void;
  onMarkProjectNotRequired: (note: string) => Promise<void> | void;
  onReopenProjectFollowup: () => Promise<void> | void;
  onReissueQuote: () => void;
  onDuplicateQuote: () => void;
  onRecordLostReason: (value: QuoteLostReasonFormValue) => Promise<void> | void;
  onLostReasonRecorded?: (payload: Record<string, unknown>) => void;
}

const QuoteWorkflowPanel = ({
  quoteId,
  quoteNumber,
  quoteTitle,
  quoteRecipient,
  quoteTotal,
  projectStage,
  quoteUserId,
  quoteStatus,
  assignedTo,
  assignedToName,
  users,
  linkedProject,
  lostReasonCategory,
  lostReasonDetail,
  lostBy,
  lostRecordedAt,
  projectFollowupStatus,
  projectFollowupNote,
  projectFollowupUpdatedAt,
  convertingProject,
  projectFollowupUpdating,
  isExpired,
  canReissue,
  reissuingQuote,
  duplicatingQuote,
  reissuedQuoteId,
  reissuedFromQuoteId,
  onStageChanged,
  onAssigneeChanged,
  onConvertProject,
  onMarkProjectNotRequired,
  onReopenProjectFollowup,
  onReissueQuote,
  onDuplicateQuote,
  onRecordLostReason,
  onLostReasonRecorded,
}: QuoteWorkflowPanelProps) => {
  const navigate = useNavigate();
  const [notRequiredDialogOpen, setNotRequiredDialogOpen] = useState(false);
  const [notRequiredNote, setNotRequiredNote] = useState('');
  const [lostReasonDialogOpen, setLostReasonDialogOpen] = useState(false);
  const normalizedProjectStage = normalizeProjectStage(projectStage, quoteStatus);
  const stageInfo = getStageInfo(normalizedProjectStage);
  const isProjectFollowupNotRequired = projectFollowupStatus === 'not_required';
  const canRecordLoss = canRecordQuoteLostReason(normalizedProjectStage, quoteStatus, linkedProject?.id || null);
  const isLossAnalysisTarget = Boolean(lostRecordedAt);
  const hasLostReason = Boolean(lostReasonCategory || lostReasonDetail);
  const followupUpdatedDate = projectFollowupUpdatedAt
    ? new Date(projectFollowupUpdatedAt).toLocaleDateString('ko-KR')
    : null;
  const { data: projectStartApproval } = useQuery({
    queryKey: ['quote-workflow-project-approval', linkedProject?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('approval_requests')
        .select('id, status')
        .eq('related_project_id', linkedProject?.id)
        .eq('request_type', 'project_start')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; status: any } | null;
    },
    enabled: !!linkedProject?.id,
  });

  const submitNotRequired = async () => {
    const note = notRequiredNote.trim();
    if (note.length < 2) return;
    await onMarkProjectNotRequired(note);
    setNotRequiredDialogOpen(false);
    setNotRequiredNote('');
  };

  const submitLostReason = async (value: QuoteLostReasonFormValue) => {
    try {
      await onRecordLostReason(value);
      setLostReasonDialogOpen(false);
    } catch (error) {
      console.error('Quote loss record failed:', error);
      toast.error(error instanceof Error ? error.message : '수주 실패 처리에 실패했습니다.');
    }
  };

  return (
    <>
    <Card className="print:hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <UserCheck className="h-4 w-4" />
          견적 업무 관리
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-muted-foreground">진행 단계</div>
          <ProjectStageSelect
            quoteId={quoteId}
            currentStage={projectStage || 'quote_issued'}
            quoteNumber={quoteNumber}
            quoteTitle={quoteTitle || undefined}
            quoteRecipient={quoteRecipient || undefined}
            quoteTotal={quoteTotal}
            quoteStatus={quoteStatus}
            projectId={linkedProject?.id}
            quoteUserId={quoteUserId}
            onStageChanged={onStageChanged}
            onLostReasonRecorded={onLostReasonRecorded}
          />
          <p className="text-[11px] leading-relaxed text-muted-foreground">{stageInfo.description}</p>
        </div>

        {(isExpired || reissuedQuoteId || reissuedFromQuoteId) && (
          <div className="rounded-lg border bg-muted/20 p-3 text-xs">
            {isExpired && !reissuedQuoteId && (
              <div className="mb-2 text-muted-foreground">유효기간이 만료된 견적입니다.</div>
            )}
            {canReissue && (
              <Button
                type="button"
                variant="outline"
                className="h-8 w-full justify-start gap-2 text-xs text-blue-700"
                onClick={onReissueQuote}
                disabled={reissuingQuote}
              >
                {reissuingQuote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                견적 재발행
              </Button>
            )}
            {reissuedQuoteId && (
              <Button
                type="button"
                variant="ghost"
                className="h-8 w-full justify-start px-0 text-xs text-primary"
                onClick={() => navigate(`/saved-quotes/${reissuedQuoteId}`)}
              >
                최신 재발행본 보기
              </Button>
            )}
            {reissuedFromQuoteId && (
              <Button
                type="button"
                variant="ghost"
                className="h-8 w-full justify-start px-0 text-xs text-primary"
                onClick={() => navigate(`/saved-quotes/${reissuedFromQuoteId}`)}
              >
                원본 견적 보기
              </Button>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-muted-foreground">담당자</div>
          <QuoteAssigneeSelect
            quoteId={quoteId}
            quoteNumber={quoteNumber}
            currentAssigneeId={assignedTo}
            currentAssigneeName={assignedToName}
            users={users}
            onAssigneeChanged={onAssigneeChanged}
          />
        </div>

        <div className="border-t pt-3">
          <div className="mb-2 text-[11px] font-medium text-muted-foreground">견적 액션</div>
          {canRecordLoss && (
            <Button
              type="button"
              variant="outline"
              className="mb-2 w-full justify-start gap-2 border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => setLostReasonDialogOpen(true)}
            >
              <XCircle className="h-4 w-4" />
              수주 실패 처리
            </Button>
          )}
          {!canRecordLoss && normalizedProjectStage === 'cancelled' && isLossAnalysisTarget && (
            <div className="mb-2 rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-red-700">
              <div className="font-semibold">수주 실패/취소 처리됨</div>
              <p className="mt-1 leading-relaxed">
                {getQuoteLostReasonLabel(lostReasonCategory)}
                {lostBy ? ` · ${getQuoteLostByLabel(lostBy)}` : ''}
                {lostRecordedAt ? ` · ${new Date(lostRecordedAt).toLocaleDateString('ko-KR')}` : ''}
              </p>
              {lostReasonDetail && (
                <p className="mt-2 rounded-md bg-white/70 px-2 py-1 leading-relaxed">{lostReasonDetail}</p>
              )}
              {!hasLostReason && <p className="mt-1 text-red-600">원인 미입력 상태입니다.</p>}
            </div>
          )}
          {!canRecordLoss && normalizedProjectStage === 'cancelled' && !isLossAnalysisTarget && (
            <div className="mb-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground">기존 취소 견적</div>
              <p className="mt-1 leading-relaxed">
                수주 실패 원인 분석 도입 전 취소건으로, 원인 미입력 관리 대상에는 포함하지 않습니다.
              </p>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={onDuplicateQuote}
            disabled={duplicatingQuote}
          >
            {duplicatingQuote ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            견적서 복제
          </Button>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            새 견적번호와 오늘 날짜로 복사본을 생성합니다.
          </p>
        </div>

        <div className="border-t pt-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
            <FolderOpen className="h-3.5 w-3.5" />
            프로젝트 연결
          </div>
          {linkedProject ? (
            <button
              type="button"
              onClick={() => navigate(`/project-management?id=${linkedProject.id}`)}
              className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{linkedProject.name}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </div>
              {linkedProject.payment_status && (
                <Badge variant="outline" className="mt-2 text-xs">
                  {linkedProject.payment_status}
                </Badge>
              )}
              {projectStartApproval && (
                <Badge variant="secondary" className={`mt-2 rounded-full border text-xs ${getApprovalStatusClass(projectStartApproval.status)}`}>
                  개시 품의 {getApprovalStatusLabel(projectStartApproval.status)}
                </Badge>
              )}
            </button>
          ) : (
            <div className="space-y-2">
              {isProjectFollowupNotRequired ? (
                <div className="rounded-lg border bg-muted/20 p-3 text-xs">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge variant="outline" className="rounded-full border-muted-foreground/30 bg-background text-muted-foreground">
                      프로젝트 전환 불필요
                    </Badge>
                    {followupUpdatedDate && (
                      <span className="text-[11px] text-muted-foreground">{followupUpdatedDate}</span>
                    )}
                  </div>
                  <p className="leading-relaxed text-muted-foreground">
                    {projectFollowupNote || '프로젝트 전환 제외 사유가 기록되어 있습니다.'}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 h-8 w-full justify-start text-xs"
                    onClick={onReopenProjectFollowup}
                    disabled={projectFollowupUpdating}
                  >
                    {projectFollowupUpdating && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    프로젝트 전환 필요로 되돌리기
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={onConvertProject}
                    disabled={convertingProject}
                  >
                    {convertingProject ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PlusCircle className="h-4 w-4" />
                    )}
                    프로젝트로 전환
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 w-full justify-start text-xs text-muted-foreground"
                    onClick={() => setNotRequiredDialogOpen(true)}
                    disabled={projectFollowupUpdating}
                  >
                    프로젝트 전환 불필요 처리
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
    <Dialog open={notRequiredDialogOpen} onOpenChange={setNotRequiredDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>프로젝트 전환 불필요 처리</DialogTitle>
          <DialogDescription>
            이 견적은 홈 후속관리와 검토센터의 프로젝트 전환 대상에서 제외됩니다. 제외 사유를 남겨주세요.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={notRequiredNote}
          onChange={(event) => setNotRequiredNote(event.target.value)}
          placeholder="예: 단순 판재 구매 건이라 프로젝트 생성이 필요 없음"
          className="min-h-[110px]"
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setNotRequiredDialogOpen(false)}>
            취소
          </Button>
          <Button
            type="button"
            onClick={submitNotRequired}
            disabled={projectFollowupUpdating || notRequiredNote.trim().length < 2}
          >
            {projectFollowupUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <QuoteLostReasonDialog
      open={lostReasonDialogOpen}
      onOpenChange={setLostReasonDialogOpen}
      quote={{
        quoteNumber,
        title: quoteTitle,
        recipient: quoteRecipient,
        total: quoteTotal,
      }}
      onSubmit={submitLostReason}
    />
    </>
  );
};

export default QuoteWorkflowPanel;
