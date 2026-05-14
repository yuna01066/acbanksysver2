import React from 'react';
import { Trash2, RotateCcw, History } from 'lucide-react';
import { CASTING_QUALITIES } from '@/types/calculator';
import type { CutItem } from '@/hooks/useYieldCalculator';

export interface HistoryItem {
  id: string;
  quality: string;
  thickness: string;
  cut_items: unknown;
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
    <div className="skeuo-card p-6">
      <h3 className="flex items-center gap-2 text-title font-semibold text-foreground mb-4">
        <History className="w-5 h-5" />
        최근 계산 이력
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {history.slice(0, 10).map(item => {
          const items = item.cut_items as CutItem[];
          const summary = items.map(it => `${it.width}×${it.height}`).join(', ');
          return (
            <div key={item.id} className="skeuo-inset flex items-center justify-between p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="skeuo-badge">{getQualityName(item.quality)}</span>
                  <span className="skeuo-badge">{item.thickness}</span>
                  {item.best_efficiency != null && (
                    <span className="text-xs font-medium text-primary">{Number(item.best_efficiency).toFixed(1)}%</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">{summary}</div>
                <div className="text-xs text-muted-foreground">{formatDate(item.created_at)}</div>
              </div>
              <div className="flex gap-1 shrink-0 ml-2">
                <button onClick={() => onRestore(item)} className="skeuo-plastic p-2" title="불러오기">
                  <RotateCcw className="w-4 h-4 text-foreground" />
                </button>
                <button onClick={() => onDelete(item.id)} className="skeuo-plastic p-2" title="삭제">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default YieldHistoryPanel;
