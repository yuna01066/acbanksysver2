import { ExternalLink, FolderOpen, Loader2, PlusCircle, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import QuoteStatusSelect from '@/components/QuoteStatusSelect';
import QuoteAssigneeSelect, { type QuoteAssigneeOption } from '@/components/QuoteAssigneeSelect';
import { getQuoteStatusInfo, type QuoteStatusValue } from '@/utils/quoteStatus';

interface LinkedProject {
  id: string;
  name: string;
  payment_status: string | null;
}

interface QuoteWorkflowPanelProps {
  quoteId: string;
  quoteNumber: string;
  quoteStatus?: string | null;
  projectStage?: string | null;
  quoteUserId?: string | null;
  assignedTo?: string | null;
  assignedToName?: string | null;
  users: QuoteAssigneeOption[];
  linkedProject: LinkedProject | null;
  convertingProject?: boolean;
  onStatusChanged: (status: QuoteStatusValue) => void;
  onAssigneeChanged: (assigneeId: string | null, assigneeName: string | null) => void;
  onConvertProject: () => void;
}

const QuoteWorkflowPanel = ({
  quoteId,
  quoteNumber,
  quoteStatus,
  projectStage,
  quoteUserId,
  assignedTo,
  assignedToName,
  users,
  linkedProject,
  convertingProject,
  onStatusChanged,
  onAssigneeChanged,
  onConvertProject,
}: QuoteWorkflowPanelProps) => {
  const navigate = useNavigate();
  const statusInfo = getQuoteStatusInfo(quoteStatus, projectStage);

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
          <div className="text-[11px] font-medium text-muted-foreground">견적 상태</div>
          <QuoteStatusSelect
            quoteId={quoteId}
            currentStatus={quoteStatus}
            projectStage={projectStage}
            quoteNumber={quoteNumber}
            quoteUserId={quoteUserId}
            onStatusChanged={onStatusChanged}
          />
          <p className="text-[11px] leading-relaxed text-muted-foreground">{statusInfo.description}</p>
        </div>

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
