import { Copy, ExternalLink, FolderOpen, Loader2, PlusCircle, RotateCcw, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ProjectStageSelect from '@/components/ProjectStageSelect';
import QuoteAssigneeSelect, { type QuoteAssigneeOption } from '@/components/QuoteAssigneeSelect';
import { getStageInfo } from '@/utils/quoteWorkflow';
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
  projectStage?: string | null;
  quoteUserId?: string | null;
  assignedTo?: string | null;
  assignedToName?: string | null;
  users: QuoteAssigneeOption[];
  linkedProject: LinkedProject | null;
  convertingProject?: boolean;
  isExpired?: boolean;
  canReissue?: boolean;
  reissuingQuote?: boolean;
  duplicatingQuote?: boolean;
  reissuedQuoteId?: string | null;
  reissuedFromQuoteId?: string | null;
  onStageChanged: (stage: string) => void;
  onAssigneeChanged: (assigneeId: string | null, assigneeName: string | null) => void;
  onConvertProject: () => void;
  onReissueQuote: () => void;
  onDuplicateQuote: () => void;
}

const QuoteWorkflowPanel = ({
  quoteId,
  quoteNumber,
  projectStage,
  quoteUserId,
  assignedTo,
  assignedToName,
  users,
  linkedProject,
  convertingProject,
  isExpired,
  canReissue,
  reissuingQuote,
  duplicatingQuote,
  reissuedQuoteId,
  reissuedFromQuoteId,
  onStageChanged,
  onAssigneeChanged,
  onConvertProject,
  onReissueQuote,
  onDuplicateQuote,
}: QuoteWorkflowPanelProps) => {
  const navigate = useNavigate();
  const stageInfo = getStageInfo(projectStage);
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

  return (
    <Card className="print:hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <UserCheck className="h-4 w-4" />
          견적 업무 관리
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-muted-foreground">상태/단계</div>
          <ProjectStageSelect
            quoteId={quoteId}
            currentStage={projectStage || 'quote_issued'}
            quoteNumber={quoteNumber}
            quoteUserId={quoteUserId}
            onStageChanged={onStageChanged}
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
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default QuoteWorkflowPanel;
