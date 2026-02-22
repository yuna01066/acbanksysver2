import React from 'react';
import { useQuoteStageHistory } from '@/hooks/useQuoteStageHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitBranch } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getStageInfo } from '@/components/ProjectStageSelect';

interface Props {
  quoteId: string;
}

const QuoteStageTimeline: React.FC<Props> = ({ quoteId }) => {
  const { history, isLoading } = useQuoteStageHistory(quoteId);

  if (isLoading) return null;
  if (history.length === 0) {
    return (
      <Card className="print:hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            상태 변경 이력
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">상태 변경 이력이 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="print:hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitBranch className="w-4 h-4" />
          상태 변경 이력
          <Badge variant="secondary" className="text-[10px] ml-auto">{history.length}건</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative pl-4 space-y-3">
          {/* Timeline line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
          
          {history.map((entry, idx) => {
            const newStageInfo = getStageInfo(entry.new_stage);
            const oldStageInfo = entry.old_stage ? getStageInfo(entry.old_stage) : null;
            
            return (
              <div key={entry.id} className="relative flex items-start gap-2.5">
                {/* Dot */}
                <div className={`absolute -left-4 top-1 w-2.5 h-2.5 rounded-full border-2 ${idx === 0 ? 'bg-primary border-primary' : 'bg-background border-muted-foreground/40'}`} />
                
                <div className="flex-1 text-xs">
                  <div className="flex items-center gap-1 flex-wrap">
                    {oldStageInfo && (
                      <>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${oldStageInfo.color}`}>
                          {oldStageInfo.label}
                        </span>
                        <span className="text-muted-foreground">→</span>
                      </>
                    )}
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${newStageInfo.color}`}>
                      {newStageInfo.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {entry.changed_by_name} · {format(new Date(entry.created_at), 'MM.dd HH:mm')}
                    {' · '}
                    {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: ko })}
                  </p>
                  {entry.memo && (
                    <p className="text-[10px] text-muted-foreground/80 mt-0.5 italic">{entry.memo}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default QuoteStageTimeline;
