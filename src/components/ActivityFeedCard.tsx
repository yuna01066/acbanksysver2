import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, FileText, Edit, ArrowRightLeft, Trash2, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ActivityLog {
  id: string;
  user_name: string;
  action_type: string;
  target_id: string | null;
  target_name: string;
  metadata: Record<string, any>;
  created_at: string;
}

interface NotionProject {
  id: string;
  title: string;
  lastEditedTime: string;
  assignee: string;
  url: string;
}

const ACTION_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  quote_created: { icon: <FileText className="h-3.5 w-3.5" />, label: '견적 발행', color: 'text-green-600' },
  quote_updated: { icon: <Edit className="h-3.5 w-3.5" />, label: '견적 수정', color: 'text-blue-600' },
  stage_changed: { icon: <ArrowRightLeft className="h-3.5 w-3.5" />, label: '단계 변경', color: 'text-orange-600' },
  quote_deleted: { icon: <Trash2 className="h-3.5 w-3.5" />, label: '견적 삭제', color: 'text-red-600' },
  notion_edited: { icon: <BookOpen className="h-3.5 w-3.5" />, label: 'Notion 수정', color: 'text-purple-600' },
};

const ActivityFeedCard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch quote activity logs
  const { data: activityLogs = [] } = useQuery({
    queryKey: ['activity-logs'],
    queryFn: async () => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as ActivityLog[];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Fetch recently edited Notion projects
  const { data: notionEdits = [] } = useQuery({
    queryKey: ['notion-recent-edits'],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke('notion-projects');
      if (!data?.projects) return [];
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return (data.projects as NotionProject[])
        .filter((p) => new Date(p.lastEditedTime) > oneDayAgo)
        .sort((a, b) => new Date(b.lastEditedTime).getTime() - new Date(a.lastEditedTime).getTime())
        .slice(0, 10);
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  // Merge and sort all activities
  const allActivities = React.useMemo(() => {
    const items: Array<{
      id: string;
      type: string;
      userName: string;
      targetName: string;
      targetId: string | null;
      metadata: Record<string, any>;
      createdAt: Date;
      url?: string;
    }> = [];

    activityLogs.forEach((log) => {
      items.push({
        id: log.id,
        type: log.action_type,
        userName: log.user_name,
        targetName: log.target_name,
        targetId: log.target_id,
        metadata: log.metadata,
        createdAt: new Date(log.created_at),
      });
    });

    notionEdits.forEach((project) => {
      items.push({
        id: `notion-${project.id}`,
        type: 'notion_edited',
        userName: project.assignee || '팀원',
        targetName: project.title,
        targetId: null,
        metadata: {},
        createdAt: new Date(project.lastEditedTime),
        url: project.url,
      });
    });

    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 15);
  }, [activityLogs, notionEdits]);

  const handleClick = (item: typeof allActivities[0]) => {
    if (item.type === 'notion_edited' && item.url) {
      window.open(item.url, '_blank');
    } else if (item.targetId && item.type !== 'quote_deleted') {
      navigate(`/saved-quotes/${item.targetId}`);
    }
  };

  if (!user) return null;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="w-4 h-4 text-primary" />
          팀 활동 피드
          {allActivities.length > 0 && (
            <Badge variant="secondary" className="text-xs ml-auto">
              {allActivities.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {allActivities.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
            최근 활동이 없습니다
          </div>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="space-y-2">
              {allActivities.map((item) => {
                const config = ACTION_CONFIG[item.type] || ACTION_CONFIG.quote_updated;
                const isClickable = item.type === 'notion_edited' ? !!item.url : !!item.targetId && item.type !== 'quote_deleted';

                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border bg-card ${isClickable ? 'cursor-pointer hover:bg-accent/5 transition-colors' : ''}`}
                    onClick={() => isClickable && handleClick(item)}
                  >
                    <div className={`mt-0.5 ${config.color}`}>
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-relaxed">
                        <span className="font-medium">{item.userName}</span>
                        <span className="text-muted-foreground">님이 </span>
                        <span className="font-medium truncate">{item.targetName}</span>
                        {item.type === 'stage_changed' && item.metadata?.newStage && (
                          <span className="text-muted-foreground">
                            → <Badge variant="outline" className="text-[10px] px-1 py-0">{item.metadata.newStage}</Badge>
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {config.label} · {formatDistanceToNow(item.createdAt, { addSuffix: true, locale: ko })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityFeedCard;
