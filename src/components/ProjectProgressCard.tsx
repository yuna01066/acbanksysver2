import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNotionProjects, type NotionProject } from '@/hooks/useNotionProjects';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { BookOpen, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInDays, parseISO, isValid } from 'date-fns';
import { BrandedCardHeader } from '@/components/ui/branded-card-header';

interface QuoteProject {
  id: string;
  project_name: string;
  project_stage: string;
  quote_status?: string | null;
  quote_number: string;
}

const STAGE_ORDER: Record<string, number> = {
  'reviewing': 1,
  'quote_issued': 2,
  'revision_requested': 2,
  'on_hold': 2,
  'contracted': 3,
  'invoice_issued': 4,
  'in_progress': 5,
  'panel_ordered': 6,
  'manufacturing': 7,
  'completed': 8,
  'delivery_scheduled': 9,
  'delivered': 10,
  'cancelled': 0,
};

const STAGE_LABELS: Record<string, string> = {
  'reviewing': '검토중',
  'quote_issued': '견적 발행',
  'revision_requested': '수정요청',
  'on_hold': '보류',
  'contracted': '수주',
  'invoice_issued': '계산서 발행',
  'in_progress': '진행중',
  'panel_ordered': '원판발주',
  'manufacturing': '제작중',
  'completed': '제작완료',
  'delivery_scheduled': '납기 예정',
  'delivered': '납기 완료',
  'cancelled': '취소',
};

function getQuoteProgress(stage: string): number {
  const order = STAGE_ORDER[stage] ?? 0;
  if (stage === 'cancelled') return 0;
  return Math.round((order / 10) * 100);
}

function getNotionProgress(startDate: string, endDate: string, status: string): number {
  // Must have both start and end dates to show progress
  if (!startDate || !endDate) return -1;
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const now = new Date();
  if (!isValid(start) || !isValid(end)) return -1;
  const total = differenceInDays(end, start);
  if (total <= 0) return 100;
  const elapsed = differenceInDays(now, start);
  if (elapsed <= 0) return 0;
  if (elapsed >= total) return 100;
  return Math.round((elapsed / total) * 100);
}

const STATUS_COLORS: Record<string, string> = {
  'not started': 'text-muted-foreground',
  'in progress': 'text-muted-foreground',
  'done': 'text-muted-foreground',
};

function getStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === 'done') return '완료';
  if (s === 'in progress') return '진행중';
  if (s === 'not started') return '시작 전';
  return status;
}

const ProjectProgressCard = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, isModerator } = useAuth();
  const { data: notionProjects = [], isLoading: notionLoading } = useNotionProjects({
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: quoteProjects, isLoading: quotesLoading } = useQuery({
    queryKey: ['quote-projects-progress'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_quotes')
        .select('id, project_name, project_stage, quote_number, desired_delivery_date')
        .not('project_stage', 'eq', 'delivered')
        .not('project_stage', 'eq', 'cancelled')
        .not('desired_delivery_date', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || []) as (QuoteProject & { desired_delivery_date: string })[];
    },
  });

  // Helper: check if current user's name matches any Notion assignee
  const isNotionAssignedToMe = (assigneeList: string[]) => {
    if (!profile?.full_name || assigneeList.length === 0) return false;
    const myChars = profile.full_name.replace(/\s/g, '').split('').sort().join('');
    return assigneeList.some((name) => {
      const nChars = name.replace(/\s/g, '').split('').sort().join('');
      return myChars === nChars;
    });
  };

  // Notion: show only projects assigned to me (admin/moderator see all)
  const notionWithProgress = (notionProjects || [])
    .filter((p) => isAdmin || isModerator || isNotionAssignedToMe(p.assigneeList || []))
    .map((p) => ({
      ...p,
      progress: getNotionProgress(p.startDate, p.endDate, p.status),
    }))
    .filter((p) => p.progress >= 0 && p.progress < 100);

  // Quotes: RLS already filters by user_id for non-admin, so no extra filter needed
  const quoteWithProgress = (quoteProjects || []).map((q) => ({
    ...q,
    progress: getQuoteProgress(q.project_stage),
  }));

  const isLoading = notionLoading || quotesLoading;
  const hasData = notionWithProgress.length > 0 || quoteWithProgress.length > 0;

  return (
    <Card className="flex h-full min-h-[160px] w-full flex-col rounded-lg border-border bg-card shadow-none">
      <CardHeader className="pb-2">
        <BrandedCardHeader icon={FileSpreadsheet} title="프로젝트 진행률" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-3 pt-0">
        {isLoading ? (
          <div className="flex min-h-[180px] flex-1 items-center justify-center py-6">
            <p className="text-sm text-muted-foreground">로딩 중...</p>
          </div>
        ) : !hasData ? (
          <div className="flex min-h-[180px] flex-1 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 text-center">
            <FileSpreadsheet className="mb-2 h-8 w-8 text-muted-foreground/35" />
            <p className="text-sm text-muted-foreground">진행 중인 프로젝트가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
            {/* Notion Projects */}
            {notionWithProgress.map((project) => (
              <a
                key={`notion-${project.id}`}
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="text-xs font-medium truncate flex-1 transition-colors group-hover:text-foreground">
                    {project.title}
                  </span>
                  <Badge variant="outline" className={cn("h-4 shrink-0 border-border bg-card px-1 py-0 text-[9px]", STATUS_COLORS[project.status.toLowerCase()] || '')}>
                    {getStatusLabel(project.status)}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground shrink-0">{project.progress}%</span>
                </div>
                <Progress value={project.progress} className="h-1.5 bg-muted [&>div]:bg-foreground" />
                {project.assignee && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{project.assignee}</p>
                )}
              </a>
            ))}

            {/* Quote Projects */}
            {quoteWithProgress.map((quote) => (
              <div
                key={`quote-${quote.id}`}
                className="cursor-pointer group"
                onClick={() => navigate(`/saved-quotes/${quote.id}`)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <FileSpreadsheet className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="text-xs font-medium truncate flex-1 transition-colors group-hover:text-foreground">
                    {quote.project_name || `견적 ${quote.quote_number}`}
                  </span>
                  <Badge variant="outline" className="h-4 shrink-0 border-border bg-card px-1 py-0 text-[9px] text-muted-foreground">
                    {STAGE_LABELS[quote.project_stage] || quote.project_stage}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground shrink-0">{quote.progress}%</span>
                </div>
                <Progress value={quote.progress} className="h-1.5 bg-muted [&>div]:bg-foreground" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProjectProgressCard;
