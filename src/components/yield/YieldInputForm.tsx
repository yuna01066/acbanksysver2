import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, Calculator, BookmarkPlus, FolderOpen } from 'lucide-react';
import { CASTING_QUALITIES } from '@/types/calculator';
import type { CutItem } from '@/hooks/useYieldCalculator';

interface YieldInputFormProps {
  cutItems: CutItem[];
  setCutItems: React.Dispatch<React.SetStateAction<CutItem[]>>;
  selectedQuality: string;
  setSelectedQuality: (v: string) => void;
  selectedThickness: string;
  setSelectedThickness: (v: string) => void;
  availableThicknesses: string[];
  isCalculating: boolean;
  calculationProgress: number;
  onCalculate: () => void;
  onSavePreset: () => void;
  onLoadPreset: () => void;
  hasPresets: boolean;
}

const YieldInputForm: React.FC<YieldInputFormProps> = ({
  cutItems, setCutItems,
  selectedQuality, setSelectedQuality,
  selectedThickness, setSelectedThickness,
  availableThicknesses,
  isCalculating, calculationProgress,
  onCalculate, onSavePreset, onLoadPreset, hasPresets,
}) => {
  const addCutItem = () => {
    if (cutItems.length >= 100) return;
    const newId = (Math.max(...cutItems.map(item => parseInt(item.id)), 0) + 1).toString();
    setCutItems(prev => [...prev, { id: newId, width: '', height: '', quantity: '' }]);
  };

  const removeCutItem = (id: string) => {
    if (cutItems.length > 1) setCutItems(prev => prev.filter(item => item.id !== id));
  };

  const updateCutItem = (id: string, field: keyof CutItem, value: string) => {
    if ((field === 'width' || field === 'height') && parseFloat(value) > 3000) value = '3000';
    if (field === 'quantity' && parseInt(value) > 1000) value = '1000';
    setCutItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const hasValidItems = cutItems.some(item => item.width && item.height && item.quantity && parseFloat(item.width) > 0 && parseFloat(item.height) > 0 && parseInt(item.quantity) > 0);

  return (
    <div className="skeuo-card p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-title font-semibold text-foreground">재단 정보 입력</h3>
        <div className="flex gap-2">
          {hasPresets && (
            <button onClick={onLoadPreset} className="skeuo-plastic px-4 py-2 text-sm flex items-center gap-1.5 text-foreground">
              <FolderOpen className="w-4 h-4" />
              프리셋 불러오기
            </button>
          )}
          {hasValidItems && (
            <button onClick={onSavePreset} className="skeuo-plastic px-4 py-2 text-sm flex items-center gap-1.5 text-foreground">
              <BookmarkPlus className="w-4 h-4" />
              프리셋 저장
            </button>
          )}
        </div>
      </div>

      {/* Quality & Thickness selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quality" className="text-sm font-medium text-foreground">재질</Label>
          <div className="skeuo-inset">
            <select
              id="quality"
              value={selectedQuality}
              onChange={e => setSelectedQuality(e.target.value)}
              className="w-full h-10 px-3 bg-transparent focus:outline-none text-foreground"
            >
              {CASTING_QUALITIES.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="thickness" className="text-sm font-medium text-foreground">두께</Label>
          <div className="skeuo-inset">
            <select
              id="thickness"
              value={selectedThickness}
              onChange={e => setSelectedThickness(e.target.value)}
              className="w-full h-10 px-3 bg-transparent focus:outline-none text-foreground"
            >
              {availableThicknesses.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Cut items */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-medium text-foreground">재단할 도형 정보</Label>
            <p className="text-xs text-muted-foreground mt-0.5">가로/세로 최대 3000mm, 수량 최대 1000개</p>
          </div>
          <button onClick={addCutItem} disabled={cutItems.length >= 100} className="skeuo-plastic px-3 py-2 text-sm flex items-center gap-2 text-foreground disabled:opacity-50">
            <Plus className="w-4 h-4" />
            추가 ({cutItems.length}/100)
          </button>
        </div>

        {cutItems.map((item, index) => (
          <div key={item.id} className="skeuo-inset p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">가로 (mm)</Label>
                <input
                  type="number" placeholder="예: 300" min="1" max="3000"
                  value={item.width} onChange={e => updateCutItem(item.id, 'width', e.target.value)}
                  className="w-full h-9 px-3 bg-transparent rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">세로 (mm)</Label>
                <input
                  type="number" placeholder="예: 200" min="1" max="3000"
                  value={item.height} onChange={e => updateCutItem(item.id, 'height', e.target.value)}
                  className="w-full h-9 px-3 bg-transparent rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">수량 (개)</Label>
                <input
                  type="number" placeholder="예: 50" min="1" max="1000"
                  value={item.quantity} onChange={e => updateCutItem(item.id, 'quantity', e.target.value)}
                  className="w-full h-9 px-3 bg-transparent rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-transparent">&nbsp;</Label>
                <div className="flex items-center gap-2 h-9">
                  <span className="skeuo-badge text-muted-foreground">도형 {index + 1}</span>
                  {cutItems.length > 1 && (
                    <button onClick={() => removeCutItem(item.id)} className="skeuo-plastic p-1.5 text-destructive hover:text-destructive" title="삭제">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Calculate button */}
      <div className="flex justify-center pt-4">
        <button
          onClick={onCalculate}
          className="skeuo-primary px-10 py-3 text-base flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          disabled={!hasValidItems || isCalculating}
        >
          <Calculator className="w-5 h-5" />
          {isCalculating ? '계산 중...' : '계산하기'}
        </button>
      </div>

      {/* Progress */}
      {isCalculating && (
        <div className="space-y-3 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">계산 진행 중...</span>
            <span className="font-medium text-primary">{calculationProgress}%</span>
          </div>
          <div className="skeuo-inset p-0.5 rounded-full">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: `${calculationProgress}%`,
                background: 'linear-gradient(180deg, hsl(215 80% 62%) 0%, hsl(215 80% 48%) 100%)',
                boxShadow: '0 1px 2px hsl(215 80% 40% / 0.3)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default YieldInputForm;
