import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-title">재단 정보 입력</span>
          <div className="flex gap-2">
            {hasPresets && (
              <Button variant="outline" size="sm" onClick={onLoadPreset} className="gap-1.5">
                <FolderOpen className="w-4 h-4" />
                프리셋 불러오기
              </Button>
            )}
            {hasValidItems && (
              <Button variant="outline" size="sm" onClick={onSavePreset} className="gap-1.5">
                <BookmarkPlus className="w-4 h-4" />
                프리셋 저장
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="quality">재질</Label>
            <select
              id="quality"
              value={selectedQuality}
              onChange={e => setSelectedQuality(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-border bg-background focus:border-primary focus:outline-none"
            >
              {CASTING_QUALITIES.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="thickness">두께</Label>
            <select
              id="thickness"
              value={selectedThickness}
              onChange={e => setSelectedThickness(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-border bg-background focus:border-primary focus:outline-none"
            >
              {availableThicknesses.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">재단할 도형 정보</Label>
              <p className="text-xs text-muted-foreground mt-0.5">가로/세로 최대 3000mm, 수량 최대 1000개</p>
            </div>
            <Button variant="outline" size="sm" onClick={addCutItem} disabled={cutItems.length >= 100} className="gap-2">
              <Plus className="w-4 h-4" />
              추가 ({cutItems.length}/100)
            </Button>
          </div>

          {cutItems.map((item, index) => (
            <div key={item.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-border rounded-xl bg-background/50">
              <div className="space-y-2">
                <Label>가로 (mm)</Label>
                <Input type="number" placeholder="예: 300" min="1" max="3000" value={item.width} onChange={e => updateCutItem(item.id, 'width', e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>세로 (mm)</Label>
                <Input type="number" placeholder="예: 200" min="1" max="3000" value={item.height} onChange={e => updateCutItem(item.id, 'height', e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>수량 (개)</Label>
                <Input type="number" placeholder="예: 50" min="1" max="1000" value={item.quantity} onChange={e => updateCutItem(item.id, 'quantity', e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground font-medium">도형 {index + 1}</span>
                  {cutItems.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeCutItem(item.id)} className="p-1 h-8 w-8 text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center pt-4">
          <Button onClick={onCalculate} className="gap-2 px-8 py-2" disabled={!hasValidItems || isCalculating}>
            <Calculator className="w-4 h-4" />
            {isCalculating ? '계산 중...' : '계산하기'}
          </Button>
        </div>

        {isCalculating && (
          <div className="space-y-3 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">계산 진행 중...</span>
              <span className="font-medium text-primary">{calculationProgress}%</span>
            </div>
            <Progress value={calculationProgress} className="h-2" />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default YieldInputForm;
