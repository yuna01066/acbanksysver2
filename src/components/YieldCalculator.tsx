import React, { useState, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package, Image as ImageIcon } from "lucide-react";
import NestingThumbnail from "@/components/NestingThumbnail";
import UnifiedRecommendations from "@/components/UnifiedRecommendations";
import YieldInputForm from "@/components/yield/YieldInputForm";
import YieldHistoryPanel from "@/components/yield/YieldHistoryPanel";
import { SavePresetDialog, LoadPresetDialog } from "@/components/yield/YieldPresetDialog";
import { calculatePanelCombinations, type CombinationResult } from "@/utils/panelCombinationCalculator";
import { calculateYieldPlan } from "@/utils/yieldOptimization";
import { useAvailablePanelSizes, useYieldPresets, useYieldHistory } from "@/hooks/useYieldCalculator";
import type { CutItem, YieldResult } from "@/hooks/useYieldCalculator";
import type { HistoryItem } from "@/components/yield/YieldHistoryPanel";
import { toast } from 'sonner';

interface YieldCalculatorProps {
  onBack: () => void;
  onPanelSelect?: (panelData: {
    quality: string;
    thickness: string;
    size: string;
    quantity: number;
    panels?: Array<{ size: string; quantity: number }>;
  }) => void;
}

const YieldCalculator: React.FC<YieldCalculatorProps> = ({ onBack, onPanelSelect }) => {
  const [cutItems, setCutItems] = useState<CutItem[]>([{ id: '1', width: '', height: '', quantity: '' }]);
  const [selectedThickness, setSelectedThickness] = useState<string>('3T');
  const [selectedQuality, setSelectedQuality] = useState<string>('glossy-color');
  const [showResults, setShowResults] = useState<boolean>(false);
  const [yieldResults, setYieldResults] = useState<YieldResult[]>([]);
  const [panelCombinations, setPanelCombinations] = useState<CombinationResult[]>([]);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [calculationProgress, setCalculationProgress] = useState<number>(0);

  // Dialogs
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [showLoadPreset, setShowLoadPreset] = useState(false);

  // Export ref
  const resultsRef = useRef<HTMLDivElement>(null);

  // Hooks
  const { availablePanelSizes, availableThicknesses } = useAvailablePanelSizes(selectedQuality, selectedThickness);
  const { presets, savePreset, deletePreset } = useYieldPresets();
  const { history, saveHistory, deleteHistory } = useYieldHistory();

  // Reset results when inputs change
  const handleSetCutItems: typeof setCutItems = (action) => {
    setCutItems(action);
    setShowResults(false);
  };

  // ---- Calculate handler ----
  const handleCalculate = async () => {
    setIsCalculating(true);
    setCalculationProgress(0);
    await new Promise(r => setTimeout(r, 100));

    try {
      const validCutItems = cutItems.filter(item =>
        item.width && item.height && item.quantity &&
        parseFloat(item.width) > 0 && parseFloat(item.height) > 0 && parseInt(item.quantity) > 0
      );
      if (validCutItems.length === 0) {
        setYieldResults([]);
        setPanelCombinations([]);
        setShowResults(true);
        return;
      }

      const itemsForNesting = validCutItems.map((item, index) => ({
        width: parseFloat(item.width),
        height: parseFloat(item.height),
        quantity: parseInt(item.quantity),
        id: `item-${index}`,
      }));

      const totalSteps = availablePanelSizes.length + 1;
      let completedSteps = 0;
      const results: YieldResult[] = [];

      for (let i = 0; i < availablePanelSizes.length; i++) {
        const panel = availablePanelSizes[i];
        await new Promise(r => setTimeout(r, 0));
        const plan = calculateYieldPlan(itemsForNesting, panel.width, panel.height, selectedThickness);
        const { canFitAll, efficiency, wasteArea, panelsNeeded, piecesPerPanel, offcut, score } = plan;

        if (canFitAll && piecesPerPanel > 0) {
          const totalRequired = itemsForNesting.reduce((sum, item) => sum + item.quantity, 0);
          const surplus = piecesPerPanel * panelsNeeded - totalRequired;
          results.push({
            panelSize: panel.name, panelWidth: panel.width, panelHeight: panel.height,
            piecesPerPanel, panelsNeeded, totalPieces: totalRequired,
            efficiency, wasteArea, surplus: Math.max(0, surplus),
            offcut,
            score,
          });
        }
        completedSteps++;
        setCalculationProgress(Math.round((completedSteps / totalSteps) * 100));
      }

      const sortedResults = results.sort((a, b) => {
        if (a.panelsNeeded !== b.panelsNeeded) return a.panelsNeeded - b.panelsNeeded;
        if (Math.abs(a.wasteArea - b.wasteArea) > 1000) return a.wasteArea - b.wasteArea;
        const aReusable = a.offcut?.largestReusableRect.area || 0;
        const bReusable = b.offcut?.largestReusableRect.area || 0;
        if (Math.abs(aReusable - bReusable) > 1000) return bReusable - aReusable;
        if (a.surplus !== b.surplus) return a.surplus - b.surplus;
        if (Math.abs(a.efficiency - b.efficiency) > 1) return b.efficiency - a.efficiency;
        return (a.score || 0) - (b.score || 0);
      });

      await new Promise(r => setTimeout(r, 0));
      const combinations = calculatePanelCombinations(itemsForNesting, availablePanelSizes, 10, selectedThickness);
      setCalculationProgress(100);

      setYieldResults(sortedResults);
      setPanelCombinations(combinations);
      setShowResults(true);

      // Auto-save to history
      const bestEff = sortedResults.length > 0 ? Math.max(...sortedResults.map(r => r.efficiency)) : 0;
      const totalPanels = sortedResults.length > 0 ? sortedResults[0].panelsNeeded : 0;
      saveHistory.mutate({
        quality: selectedQuality,
        thickness: selectedThickness,
        cutItems: validCutItems,
        results: sortedResults,
        combinations,
        bestEfficiency: bestEff,
        totalPanelsNeeded: totalPanels,
      });
    } finally {
      setIsCalculating(false);
      setCalculationProgress(0);
    }
  };

  // ---- Export as image ----
  const handleExportImage = async () => {
    if (!resultsRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(resultsRef.current, { backgroundColor: '#ffffff', scale: 2 });
      const link = document.createElement('a');
      link.download = `수율계산_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('이미지가 저장되었습니다.');
    } catch {
      toast.error('이미지 저장에 실패했습니다.');
    }
  };

  // ---- Restore from history ----
  const handleRestoreHistory = (item: HistoryItem) => {
    const items = item.cut_items as CutItem[];
    setCutItems(items);
    setSelectedQuality(item.quality);
    setSelectedThickness(item.thickness);
    setShowResults(false);
    toast.success('이력에서 불러왔습니다. 계산하기를 눌러주세요.');
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="skeuo-plastic p-2.5">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div>
          <h2 className="text-headline flex items-center gap-3">
            <Package className="w-6 h-6 text-primary" />
            수율 계산기
          </h2>
          <p className="text-body text-muted-foreground mt-1">
            재단할 도형의 크기와 수량을 입력하여 최적의 원판 사이즈를 찾아보세요
            <br />
            <span className="text-xs text-muted-foreground">※ 원판 마진 80mm, 도형 간 간격 자동 적용</span>
          </p>
        </div>
      </div>

      {/* History Panel */}
      <YieldHistoryPanel
        history={history}
        onRestore={handleRestoreHistory}
        onDelete={(id) => deleteHistory.mutate(id)}
      />

      {/* Input Form */}
      <YieldInputForm
        cutItems={cutItems}
        setCutItems={handleSetCutItems}
        selectedQuality={selectedQuality}
        setSelectedQuality={(v) => { setSelectedQuality(v); setShowResults(false); }}
        selectedThickness={selectedThickness}
        setSelectedThickness={(v) => { setSelectedThickness(v); setShowResults(false); }}
        availableThicknesses={availableThicknesses}
        isCalculating={isCalculating}
        calculationProgress={calculationProgress}
        onCalculate={handleCalculate}
        onSavePreset={() => setShowSavePreset(true)}
        onLoadPreset={() => setShowLoadPreset(true)}
        hasPresets={presets.length > 0}
      />

      {/* Results */}
      {showResults && (yieldResults.length > 0 || panelCombinations.length > 0) && (
        <div ref={resultsRef}>
        <div className="flex justify-end mb-2">
            <button onClick={handleExportImage} className="skeuo-plastic px-4 py-2 text-sm flex items-center gap-2 text-foreground">
              <ImageIcon className="w-4 h-4" />
              이미지로 저장
            </button>
          </div>
          <UnifiedRecommendations
            yieldResults={yieldResults}
            combinations={panelCombinations}
            cutItems={cutItems}
            onPanelSelect={onPanelSelect}
            selectedQuality={selectedQuality}
            selectedThickness={selectedThickness}
            availablePanelSizes={availablePanelSizes}
          />
        </div>
      )}

      {showResults && cutItems.some(item => item.width && item.height && item.quantity) && yieldResults.length === 0 && panelCombinations.length === 0 && (
        <div className="skeuo-card p-8 text-center">
          <p className="text-muted-foreground">
            입력하신 크기로는 선택된 두께에서 생산 가능한 원판이 없습니다.
            <br />더 작은 크기로 입력하거나 다른 두께를 선택해주세요.
          </p>
        </div>
      )}

      {/* Preset Dialogs */}
      <SavePresetDialog
        open={showSavePreset}
        onClose={() => setShowSavePreset(false)}
        onSave={(name) => savePreset.mutate({ name, cutItems })}
      />
      <LoadPresetDialog
        open={showLoadPreset}
        onClose={() => setShowLoadPreset(false)}
        presets={presets}
        onLoad={(items) => { setCutItems(items); setShowResults(false); toast.success('프리셋을 불러왔습니다.'); }}
        onDelete={(id) => deletePreset.mutate(id)}
      />
    </div>
  );
};

export default YieldCalculator;
