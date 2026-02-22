import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, Trash2, RotateCcw } from 'lucide-react';
import { CASTING_QUALITIES } from '@/types/calculator';
import type { CutItem } from '@/hooks/useYieldCalculator';

interface HistoryItem {
  id: string;
  quality: string;
  thickness: string;
  cut_items: any;
  best_efficiency: number | null;
  total_panels_needed: number | null;
  created_at: string;
}

interface YieldHistoryPanelProps {
  history: HistoryItem[];
  onRestore: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
}

const YieldHistoryPanel: React.FC<YieldHistoryPanelProps> = ({ history, onRestore, onDelete }) => {
  if (history.length === 0) return null;

  const getQualityName = (id: string) => CASTING_QUALITIES.find(q => q.id === id)?.name || id;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-title">
          <History className="w-5 h-5" />
          최근 계산 이력
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {history.slice(0, 10).map(item => {
            const items = item.cut_items as CutItem[];
            const summary = items.map(it => `${it.width}×${it.height}`).join(', ');
            return (
              <div key={item.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-xs shrink-0">{getQualityName(item.quality)}</Badge>
                    <Badge variant="outline" className="text-xs shrink-0">{item.thickness}</Badge>
                    {item.best_efficiency != null && (
                      <span className="text-xs font-medium text-primary">{Number(item.best_efficiency).toFixed(1)}%</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{summary}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(item.created_at)}</div>
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
                  <Button variant="ghost" size="sm" onClick={() => onRestore(item)} className="p-1 h-8 w-8" title="불러오기">
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(item.id)} className="p-1 h-8 w-8 text-destructive hover:text-destructive" title="삭제">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default YieldHistoryPanel;
