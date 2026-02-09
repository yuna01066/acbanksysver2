import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { BookOpen, FileSpreadsheet, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInDays, parseISO, isValid } from 'date-fns';

interface NotionProject {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  assignee: string;
  status: string;
  url: string;
}

interface QuoteProject {
  id: string;
  project_name: string;
  project_stage: string;
  quote_number: string;
}

const STAGE_ORDER: Record<string, number> = {
  'quote_issued': 1,
  'invoice_issued': 2,
  'in_progress': 3,
  'panel_ordered': 4,
  'manufacturing': 5,
  'completed': 6,
  'cancelled': 0,
};

const STAGE_LABELS: Record<string, string> = {
  'quote_issued': '견적 발행',
  'invoice_issued': '계산서 발행',
  'in_progress': '진행중',
  'panel_ordered': '원판발주',
  'manufacturing': '제작중',
  'completed': '제작완료',
  'cancelled': '취소',
};

function getQuoteProgress(stage: string): number {
  const order = STAGE_ORDER[stage] ?? 0;
  if (stage === 'cancelled') return 0;
  // 6 stages total (excluding cancelled), map to percentage
  return Math.round((order / 6) * 100);
}

function getNotionProgress(startDate: string, endDate: string, status: string): number {
  // If date range exists, calculate by time
  if (startDate && endDate) {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const now = new Date();
    if (isValid(start) && isValid(end)) {
      const total = differenceInDays(end, start);
      if (total <= 0) return 100;
      const elapsed = differenceInDays(now, start);
      if (elapsed <= 0) return 0;
      if (elapsed >= total) return 100;
      return Math.round((elapsed / total) * 100);
    }
  }
  // Fallback to status-based progress
  const s = status.toLowerCase();
  if (s === 'done' || s === '완료') return 100;
  if (s === 'in progress' || s === '진행중' || s === '진행 중') return 50;
  if (s === 'not started' || s === '시작 전') return 0;
  return 0;
}

const STATUS_COLORS: Record<string, string> = {
  'not started': 'text-muted-foreground',
  'in progress': 'text-amber-600',
  'done': 'text-emerald-600',
};

function getStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === 'done') return '완료';
  if (s === 'in progress') return '진행중';
  if (s === 'not started') return '시작 전';
  return status;
}

const ProjectProgressCard = () => {
  const { data: notionProjects, isLoading: notionLoading } = useQuery({
    queryKey: ['notion-projects-progress'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('notion-projects');
      if (error) return [];
      return (data?.projects || []) as NotionProject[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: quoteProjects, isLoading: quotesLoading } = useQuery({
    queryKey: ['quote-projects-progress'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_quotes')
        .select('id, project_name, project_stage, quote_number')
        .not('project_stage', 'eq', 'completed')
        .not('project_stage', 'eq', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || []) as QuoteProject[];
    },
  });

  // Notion projects with progress (exclude completed)
  const notionWithProgress = (notionProjects || [])
    .map((p) => ({
      ...p,
      progress: getNotionProgress(p.startDate, p.endDate, p.status),
    }))
    .filter((p) => p.progress < 100)
    .slice(0, 5);

  const quoteWithProgress = (quoteProjects || []).map((q) => ({
    ...q,
    progress: getQuoteProgress(q.project_stage),
  })).slice(0, 5);

  const isLoading = notionLoading || quotesLoading;
  const hasData = notionWithProgress.length > 0 || quoteWithProgress.length > 0;

  return (
    <Card className="w-full min-h-[160px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          프로젝트 진행률
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <p className="text-sm text-muted-foreground">로딩 중...</p>
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center py-6">
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
                  <BookOpen className="h-3 w-3 text-violet-500 shrink-0" />
                  <span className="text-xs font-medium truncate flex-1 group-hover:text-violet-600 transition-colors">
                    {project.title}
                  </span>
                  <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4 shrink-0", STATUS_COLORS[project.status.toLowerCase()] || '')}>
                    {getStatusLabel(project.status)}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground shrink-0">{project.progress}%</span>
                </div>
                <Progress value={project.progress} className="h-1.5 [&>div]:bg-violet-500" />
                {project.assignee && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{project.assignee}</p>
                )}
              </a>
            ))}

            {/* Quote Projects */}
            {quoteWithProgress.map((quote) => (
              <div key={`quote-${quote.id}`}>
                <div className="flex items-center gap-2 mb-1">
                  <FileSpreadsheet className="h-3 w-3 text-primary shrink-0" />
                  <span className="text-xs font-medium truncate flex-1">
                    {quote.project_name || `견적 ${quote.quote_number}`}
                  </span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">
                    {STAGE_LABELS[quote.project_stage] || quote.project_stage}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground shrink-0">{quote.progress}%</span>
                </div>
                <Progress value={quote.progress} className="h-1.5" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProjectProgressCard;
