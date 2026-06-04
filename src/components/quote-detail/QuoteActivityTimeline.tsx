import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  FileText,
  FolderOpen,
  GitBranch,
  MessageSquare,
  Paperclip,
  PencilLine,
  UserCheck,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { getStageInfo } from '@/components/ProjectStageSelect';

interface Props {
  quoteId: string;
}

interface ActivityEntry {
  id: string;
  action_type: string;
  old_value: string | null;
  new_value: string | null;
  actor_name: string;
  memo: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; Icon: React.ElementType }> = {
  status_changed: { label: '상태/단계 변경', Icon: GitBranch },
  legacy_stage_changed: { label: '프로젝트 단계 변경', Icon: GitBranch },
  assignee_changed: { label: '담당자 변경', Icon: UserCheck },
  quote_updated: { label: '견적 수정', Icon: PencilLine },
  memo_added: { label: '메모 추가', Icon: MessageSquare },
  memo_deleted: { label: '메모 삭제', Icon: MessageSquare },
  file_uploaded: { label: '파일 업로드', Icon: Paperclip },
  file_deleted: { label: '파일 삭제', Icon: Paperclip },
  project_converted: { label: '프로젝트 전환', Icon: FolderOpen },
  project_linked: { label: '프로젝트 연결', Icon: FolderOpen },
  quote_reissued: { label: '견적 재발행', Icon: GitBranch },
  created_from_reissue: { label: '재발행본 생성', Icon: GitBranch },
  quote_duplicated: { label: '견적 복제', Icon: FileText },
};

const formatValue = (actionType: string, value: string | null) => {
  if (!value) return '없음';
  if (actionType === 'status_changed') return getStageInfo(value).label;
  if (actionType === 'legacy_stage_changed') return getStageInfo(value).label;
  return value;
};

const buildDescription = (entry: ActivityEntry) => {
  if (entry.action_type === 'quote_updated') {
    return entry.metadata?.summary || '견적 내용이 수정되었습니다.';
  }
  if (entry.action_type === 'memo_added') return '내부 메모가 추가되었습니다.';
  if (entry.action_type === 'memo_deleted') return '내부 메모가 삭제되었습니다.';
  if (entry.action_type === 'file_uploaded') return `${entry.metadata?.fileName || '파일'} 업로드`;
  if (entry.action_type === 'file_deleted') return `${entry.metadata?.fileName || '파일'} 삭제`;
  if (entry.action_type === 'project_converted') return entry.metadata?.projectName || '프로젝트로 전환됨';
  if (entry.action_type === 'quote_reissued') {
    return `${entry.metadata?.originalQuoteNumber || entry.old_value || '원본'} -> ${entry.metadata?.reissuedQuoteNumber || entry.new_value || '재발행본'}`;
  }
  if (entry.action_type === 'created_from_reissue') {
    return `${entry.metadata?.originalQuoteNumber || entry.old_value || '원본'}에서 재발행됨`;
  }
  if (entry.action_type === 'quote_duplicated') {
    if (entry.metadata?.source === 'original') {
      return `${entry.metadata?.duplicatedQuoteNumber || entry.new_value || '복제본'} 복제본 생성`;
    }
    return `${entry.metadata?.originalQuoteNumber || entry.old_value || '원본'}에서 복제됨`;
  }

  if (entry.old_value || entry.new_value) {
    return `${formatValue(entry.action_type, entry.old_value)} -> ${formatValue(entry.action_type, entry.new_value)}`;
  }

  return ACTION_LABELS[entry.action_type]?.label || entry.action_type;
};

const QuoteActivityTimeline: React.FC<Props> = ({ quoteId }) => {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['quote-activity-history', quoteId],
    queryFn: async () => {
      const [{ data: activities, error: activityError }, { data: legacyStages, error: legacyError }] = await Promise.all([
        (supabase as any)
          .from('quote_activity_history')
          .select('*')
          .eq('quote_id', quoteId)
          .order('created_at', { ascending: false }),
        supabase
          .from('quote_stage_history')
          .select('*')
          .eq('quote_id', quoteId)
          .order('created_at', { ascending: false }),
      ]);

      if (activityError) throw activityError;
      if (legacyError) throw legacyError;

      const activityEntries: ActivityEntry[] = (activities || []).map((entry: any) => ({
        ...entry,
        metadata: entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {},
      }));

      const legacyEntries: ActivityEntry[] = (legacyStages || []).map((entry: any) => ({
        id: `legacy-${entry.id}`,
        action_type: 'legacy_stage_changed',
        old_value: entry.old_stage,
        new_value: entry.new_stage,
        actor_name: entry.changed_by_name,
        memo: entry.memo,
        metadata: { source: 'quote_stage_history' },
        created_at: entry.created_at,
      }));

      return [...activityEntries, ...legacyEntries].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
    enabled: !!quoteId,
  });

  if (isLoading) return null;

  return (
    <Card className="print:hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4" />
          활동 히스토리
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {history.length}건
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {history.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">아직 기록된 활동이 없습니다.</p>
        ) : (
          <div className="relative max-h-[460px] space-y-3 overflow-y-auto pl-4 pr-1">
            <div className="absolute bottom-2 left-[7px] top-2 w-px bg-border" />
            {history.map((entry, index) => {
              const meta = ACTION_LABELS[entry.action_type] || { label: entry.action_type, Icon: FileText };
              const Icon = meta.Icon;

              return (
                <div key={entry.id} className="relative flex items-start gap-2.5">
                  <div className={`absolute -left-4 top-1 flex h-3 w-3 items-center justify-center rounded-full border ${index === 0 ? 'border-primary bg-primary' : 'border-muted-foreground/40 bg-background'}`} />
                  <div className="min-w-0 flex-1 rounded-md border bg-muted/20 p-2.5 text-xs">
                    <div className="flex items-center gap-1.5 text-foreground">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                      <span className="font-semibold">{meta.label}</span>
                    </div>
                    <p className="mt-1 leading-relaxed text-muted-foreground">{buildDescription(entry)}</p>
                    {entry.memo && (
                      <p className="mt-1 rounded bg-background px-2 py-1 text-[11px] leading-relaxed text-muted-foreground">
                        {entry.memo}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground/80">
                      {entry.actor_name} · {format(new Date(entry.created_at), 'MM.dd HH:mm', { locale: ko })}
                      {' · '}
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: ko })}
                    </p>
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

export default QuoteActivityTimeline;
