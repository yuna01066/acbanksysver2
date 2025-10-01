import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Calculator, Package, Plus, Trash2 } from "lucide-react";
import NestingThumbnail from "@/components/NestingThumbnail";
import UnifiedRecommendations from "@/components/UnifiedRecommendations";
import { glossyColorSinglePrices, glossyStandardSinglePrices, astelColorSinglePrices, satinColorSinglePrices } from "@/data/glossyColorPricing";
import { CASTING_QUALITIES } from "@/types/calculator";
interface PanelSize {
  name: string;
  width: number;
  height: number;
  available: boolean;
}
interface YieldResult {
  panelSize: string;
  panelWidth: number;
  panelHeight: number;
  piecesPerPanel: number;
  panelsNeeded: number;
  totalPieces: number;
  efficiency: number;
  wasteArea: number;
  surplus: number; // 여분
}
interface CutItem {
  id: string;
  width: string;
  height: string;
  quantity: string;
}
interface YieldCalculatorProps {
  onBack: () => void;
  onPanelSelect?: (panelData: {
    quality: string;
    thickness: string;
    size: string;
    quantity: number;
  }) => void;
}
const YieldCalculator: React.FC<YieldCalculatorProps> = ({
  onBack,
  onPanelSelect
}) => {
  const [cutItems, setCutItems] = useState<CutItem[]>([{
    id: '1',
    width: '',
    height: '',
    quantity: ''
  }]);
  const [selectedThickness, setSelectedThickness] = useState<string>('3T');
  const [selectedQuality, setSelectedQuality] = useState<string>('glossy-color');
  const [showResults, setShowResults] = useState<boolean>(false);
  const [yieldResults, setYieldResults] = useState<YieldResult[]>([]);
  const [panelCombinations, setPanelCombinations] = useState<any[]>([]);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [calculationProgress, setCalculationProgress] = useState<number>(0);
  
  const workerRef = useRef<Worker | null>(null);

  // Web Worker 초기화 및 정리
  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/yieldCalculator.worker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = (e) => {
      const { type } = e.data;

      if (type === 'progress') {
        setCalculationProgress(e.data.progress);
      } else if (type === 'result') {
        setYieldResults(e.data.yieldResults);
        setPanelCombinations(e.data.combinations);
        setShowResults(true);
        setIsCalculating(false);
        setCalculationProgress(0);
      } else if (type === 'error') {
        console.error('Worker error:', e.data.error);
        setIsCalculating(false);
        setCalculationProgress(0);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // 재단 항목 추가/제거 함수
  const addCutItem = () => {
    // 최대 100개로 제한
    if (cutItems.length >= 100) {
      return;
    }
    const newId = (Math.max(...cutItems.map(item => parseInt(item.id))) + 1).toString();
    setCutItems([...cutItems, {
      id: newId,
      width: '',
      height: '',
      quantity: ''
    }]);
    // 항목 추가 시 이전 결과 숨기기
    setShowResults(false);
  };
  const removeCutItem = (id: string) => {
    if (cutItems.length > 1) {
      setCutItems(cutItems.filter(item => item.id !== id));
      // 항목 제거 시 이전 결과 숨기기
      setShowResults(false);
    }
  };
  const updateCutItem = (id: string, field: keyof CutItem, value: string) => {
    // 가로/세로 필드의 경우 최대값 3000mm 제한
    if (field === 'width' || field === 'height') {
      const numValue = parseFloat(value);
      if (numValue > 3000) {
        value = '3000';
      }
    }
    // 수량 필드의 경우 최대값 1000 제한
    if (field === 'quantity') {
      const numValue = parseInt(value);
      if (numValue > 1000) {
        value = '1000';
      }
    }
    setCutItems(cutItems.map(item => item.id === id ? {
      ...item,
      [field]: value
    } : item));
    
    // 입력값 변경 시 이전 결과 숨기기
    setShowResults(false);
  };

  // 선택된 재질에 따른 가격 데이터 매핑
  const getPriceDataByQuality = (qualityId: string) => {
    switch (qualityId) {
      case 'glossy-color':
        return glossyColorSinglePrices;
      case 'glossy-standard':
        return glossyStandardSinglePrices;
      case 'astel-color':
        return astelColorSinglePrices;
      case 'satin-color':
        return satinColorSinglePrices;
      default:
        return glossyColorSinglePrices;
    }
  };

  // 선택된 재질에서 사용 가능한 원판 사이즈 추출
  const availablePanelSizes = useMemo(() => {
    const priceData = getPriceDataByQuality(selectedQuality);
    const allSizes = new Set<string>();

    // 선택된 재질의 가격 데이터에서 사이즈 수집
    Object.values(priceData).forEach(thicknessData => {
      Object.keys(thicknessData).forEach(size => allSizes.add(size));
    });

    // 두께에 따른 원판 사이즈 조정 함수
    const getSizeByThickness = (baseWidth: number, baseHeight: number): { width: number; height: number } => {
      const thickness = parseFloat(selectedThickness?.replace('T', '') || '0');
      
      if (thickness >= 1.3 && thickness < 10) {
        // 1.3T ~ 10T 미만: 10T~20T 기준에서 20mm 더하기
        return {
          width: baseWidth + 20,
          height: baseHeight + 20
        };
      } else if (thickness >= 10 && thickness <= 20) {
        // 10T ~ 20T: 기준 사이즈 그대로
        return {
          width: baseWidth,
          height: baseHeight
        };
      } else if (thickness >= 20 && thickness <= 30) {
        // 20T ~ 30T: 10T~20T 기준에서 50mm 빼기
        return {
          width: baseWidth - 50,
          height: baseHeight - 50
        };
      }
      
      // 기본값 반환
      return {
        width: baseWidth,
        height: baseHeight
      };
    };

    // 원판 사이즈 매핑 (10T~20T 기준 치수) - usePriceCalculation.ts와 일치
    const baseSizeMapping: {
      [key: string]: {
        width: number;
        height: number;
      };
    } = {
      '3*6': {
        width: 860,
        height: 1750
      },
      '대3*6': {
        width: 900,
        height: 1800
      },
      '4*5': {
        width: 1120,
        height: 1425
      },
      '대4*5': {
        width: 1200,
        height: 1500
      },
      '1*2': {
        width: 1000,
        height: 2000
      },
      '4*6': {
        width: 1200,
        height: 1800
      },
       '4*8': {
         width: 1200,
         height: 2400
       },
      '4*10': {
        width: 1200,
        height: 3000
      },
      '5*6': {
        width: 1500,
        height: 1800
      },
      '5*8': {
        width: 1500,
        height: 2400
      }
    };

    // 두께에 따라 조정된 사이즈 매핑
    const sizeMapping: { [key: string]: { width: number; height: number } } = {};
    Object.entries(baseSizeMapping).forEach(([key, baseSize]) => {
      sizeMapping[key] = getSizeByThickness(baseSize.width, baseSize.height);
    });

    // 사이즈를 실제 치수로 변환
    const panelSizes: PanelSize[] = Array.from(allSizes).map(sizeStr => {
      const sizeInfo = sizeMapping[sizeStr];

      // 매핑에 없는 사이즈는 기본 계산 사용 (fallback)
      let width, height;
      if (sizeInfo) {
        width = sizeInfo.width;
        height = sizeInfo.height;
      } else {
        const parts = sizeStr.replace(/[소대]/g, '').split('*');
        width = parseFloat(parts[0]) * 1000;
        height = parseFloat(parts[1]) * 1000;
      }

      // 선택된 두께와 재질에서 해당 사이즈가 사용 가능한지 확인
      const isAvailable = priceData[selectedThickness] && priceData[selectedThickness][sizeStr];
      return {
        name: sizeStr,
        width,
        height,
        available: isAvailable
      };
    }).filter(panel => panel.available);
    return panelSizes.sort((a, b) => a.width * a.height - b.width * b.height);
  }, [selectedThickness, selectedQuality]);

  // 계산 함수 - Web Worker 사용
  const handleCalculate = () => {
    // 모든 재단 항목이 유효한지 확인
    const validCutItems = cutItems.filter(
      item =>
        item.width &&
        item.height &&
        item.quantity &&
        parseFloat(item.width) > 0 &&
        parseFloat(item.height) > 0 &&
        parseInt(item.quantity) > 0
    );

    if (validCutItems.length === 0) {
      setYieldResults([]);
      setPanelCombinations([]);
      setShowResults(true);
      return;
    }

    // 복합 네스팅을 위한 아이템 배열 생성
    const itemsForNesting = validCutItems.map((item, index) => ({
      width: parseFloat(item.width),
      height: parseFloat(item.height),
      quantity: parseInt(item.quantity),
      id: `item-${index}`
    }));

    // Web Worker에 계산 요청
    setIsCalculating(true);
    setCalculationProgress(0);
    setShowResults(false);

    workerRef.current?.postMessage({
      type: 'calculate',
      items: itemsForNesting,
      panelSizes: availablePanelSizes,
      thickness: selectedThickness,
      quality: selectedQuality
    });
  };

  const availableThicknesses = useMemo(() => {
    const priceData = getPriceDataByQuality(selectedQuality);
    const thicknesses = new Set<string>();
    Object.keys(priceData).forEach(thickness => thicknesses.add(thickness));
    return Array.from(thicknesses).sort((a, b) => parseFloat(a) - parseFloat(b));
  }, [selectedQuality]);
  const totalQuantity = cutItems.reduce((sum, item) => {
    const qty = parseInt(item.quantity) || 0;
    return sum + qty;
  }, 0);
  return <div className="space-y-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={onBack} className="p-2">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-headline flex items-center gap-3">
            <Package className="w-6 h-6 text-primary" />
            수율 계산기
          </h2>
          <p className="text-body text-muted-foreground mt-1">
            재단할 도형의 크기와 수량을 입력하여 최적의 원판 사이즈를 찾아보세요
            <br />
            <span className="text-xs text-muted-foreground">※ 원판 마진 80mm, 도형 간 간격 10mm가 자동 적용됩니다</span>
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-title">재단 정보 입력</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quality">재질</Label>
              <select id="quality" value={selectedQuality} onChange={e => setSelectedQuality(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border bg-background focus:border-primary focus:outline-none">
                {CASTING_QUALITIES.map(quality => <option key={quality.id} value={quality.id}>{quality.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="thickness">두께</Label>
              <select id="thickness" value={selectedThickness} onChange={e => setSelectedThickness(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border bg-background focus:border-primary focus:outline-none">
                {availableThicknesses.map(thickness => <option key={thickness} value={thickness}>{thickness}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">재단할 도형 정보</Label>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={addCutItem} 
                  disabled={cutItems.length >= 100}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  추가 ({cutItems.length}/100)
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">가로/세로 최대 3000mm, 수량 최대 1000개</p>
            </div>
            
            {cutItems.map((item, index) => <div key={item.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-border rounded-xl bg-background/50">
                <div className="space-y-2">
                  <Label htmlFor={`width-${item.id}`}>가로 (mm)</Label>
                  <Input 
                    id={`width-${item.id}`} 
                    type="number" 
                    placeholder="예: 300" 
                    min="1"
                    max="3000"
                    value={item.width} 
                    onChange={e => updateCutItem(item.id, 'width', e.target.value)} 
                    className="rounded-xl" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`height-${item.id}`}>세로 (mm)</Label>
                  <Input 
                    id={`height-${item.id}`} 
                    type="number" 
                    placeholder="예: 200" 
                    min="1"
                    max="3000"
                    value={item.height} 
                    onChange={e => updateCutItem(item.id, 'height', e.target.value)} 
                    className="rounded-xl" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`quantity-${item.id}`}>수량 (개)</Label>
                  <Input 
                    id={`quantity-${item.id}`} 
                    type="number" 
                    placeholder="예: 50" 
                    min="1"
                    max="1000"
                    value={item.quantity} 
                    onChange={e => updateCutItem(item.id, 'quantity', e.target.value)} 
                    className="rounded-xl" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground font-medium">
                      도형 {index + 1}
                    </span>
                    {cutItems.length > 1 && <Button variant="ghost" size="sm" onClick={() => removeCutItem(item.id)} className="p-1 h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>}
                  </div>
                </div>
              </div>)}
          </div>

          {/* 계산하기 버튼 */}
          <div className="flex justify-center pt-4">
            <Button 
              onClick={handleCalculate}
              className="flex items-center gap-2 px-8 py-2"
              disabled={!cutItems.some(item => item.width && item.height && item.quantity) || isCalculating}
            >
              <Calculator className="w-4 h-4" />
              {isCalculating ? '계산 중...' : '계산하기'}
            </Button>
          </div>
          
          {/* 로딩 메시지 및 진행률 */}
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

      {/* 통합 추천 결과 */}
      {showResults && (yieldResults.length > 0 || panelCombinations.length > 0) && (
        <UnifiedRecommendations 
          yieldResults={yieldResults} 
          combinations={panelCombinations} 
          cutItems={cutItems} 
          onPanelSelect={onPanelSelect} 
          selectedQuality={selectedQuality} 
          selectedThickness={selectedThickness} 
          availablePanelSizes={availablePanelSizes} 
        />
      )}

      {showResults && cutItems.some(item => item.width && item.height && item.quantity) && yieldResults.length === 0 && panelCombinations.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              입력하신 크기로는 선택된 두께에서 생산 가능한 원판이 없습니다.
              <br />
              더 작은 크기로 입력하거나 다른 두께를 선택해주세요.
            </p>
          </CardContent>
        </Card>
      )}
    </div>;
};
export default YieldCalculator;