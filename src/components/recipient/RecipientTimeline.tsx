import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, MessageSquare, FolderKanban, Clock } from 'lucide-react';
import { formatPrice } from '@/utils/priceCalculations';
import { getStageInfo } from '@/components/ProjectStageSelect';
import { useNavigate } from 'react-router-dom';

interface Props {
  recipientId: string;
  companyName: string;
}

interface TimelineItem {
  id: string;
  type: 'quote' | 'note' | 'project';
  title: string;
  subtitle?: string;
  date: string;
  badge?: { label: string; color: string };
  amount?: number;
  navigateTo?: string;
}

const RecipientTimeline: React.FC<Props> = ({ recipientId, companyName }) => {
  const navigate = useNavigate();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['recipient-timeline', recipientId, companyName],
    queryFn: async () => {
      const [quotesRes, notesRes, projectsRes] = await Promise.all([
        supabase
          .from('saved_quotes')
          .select('id, quote_number, quote_date, project_name, total, project_stage')
          .eq('recipient_company', companyName)
          .order('quote_date', { ascending: false })
          .limit(50),
        supabase
          .from('recipient_notes')
          .select('*')
          .eq('recipient_id', recipientId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('projects')
          .select('id, name, status, created_at')
          .eq('recipient_id', recipientId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const timeline: TimelineItem[] = [];

      (quotesRes.data || []).forEach((q) => {
        const stageInfo = getStageInfo(q.project_stage);
        timeline.push({
          id: q.id,
          type: 'quote',
          title: `견적서 ${q.quote_number}`,
          subtitle: q.project_name || undefined,
          date: q.quote_date,
          badge: { label: stageInfo.label, color: stageInfo.color },
          amount: q.total,
          navigateTo: `/saved-quotes/${q.id}`,
        });
      });

      (notesRes.data || []).forEach((n: any) => {
        timeline.push({
          id: n.id,
          type: 'note',
          title: n.title || (n.note_type === 'consultation' ? '상담 기록' : '메모'),
          subtitle: n.content.length > 60 ? n.content.slice(0, 60) + '...' : n.content,
          date: n.created_at,
          badge: { label: n.note_type === 'consultation' ? '상담' : '메모', color: n.note_type === 'consultation' ? 'text-blue-600 border-blue-300' : 'text-gray-600 border-gray-300' },
        });
      });

      (projectsRes.data || []).forEach((p: any) => {
        timeline.push({
          id: p.id,
          type: 'project',
          title: p.name,
          date: p.created_at,
          badge: { label: p.status || '진행중', color: 'text-emerald-600 border-emerald-300' },
          navigateTo: `/project-management?id=${p.id}`,
        });
      });

      timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return timeline;
    },
  });

  const iconMap = {
    quote: FileText,
    note: MessageSquare,
    project: FolderKanban,
  };

  const colorMap = {
    quote: 'bg-violet-500/10 text-violet-500',
    note: 'bg-blue-500/10 text-blue-500',
    project: 'bg-emerald-500/10 text-emerald-500',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5" />
          거래 이력 타임라인
          <Badge variant="secondary" className="ml-2">{items.length}건</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">로딩 중...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">거래 이력이 없습니다.</div>
        ) : (
          <div className="relative space-y-0">
            <div className="absolute left-5 top-3 bottom-3 w-px bg-border" />
            {items.map((item) => {
              const Icon = iconMap[item.type];
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className={`relative flex gap-4 py-3 ${item.navigateTo ? 'cursor-pointer hover:bg-muted/30 rounded-lg px-1 -mx-1' : ''}`}
                  onClick={() => item.navigateTo && navigate(item.navigateTo)}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 ${colorMap[item.type]}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{item.title}</span>
                      {item.badge && (
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${item.badge.color}`}>
                          {item.badge.label}
                        </Badge>
                      )}
                      {item.amount != null && (
                        <span className="text-sm font-semibold text-primary ml-auto shrink-0">{formatPrice(item.amount)}</span>
                      )}
                    </div>
                    {item.subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.subtitle}</p>}
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                      {new Date(item.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
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

export default RecipientTimeline;
