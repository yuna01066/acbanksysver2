import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Calculator, Users } from "lucide-react";
import { toast } from "sonner";
import SelectionSummary from '@/components/SelectionSummary';
import UnifiedRecommendations from '@/components/UnifiedRecommendations';
import { useUnifiedCalculation } from '@/hooks/useUnifiedCalculation';

// 가격 데이터 임포트
import {
  glossyColorSinglePrices,
  glossyStandardSinglePrices,
  astelColorSinglePrices,
  satinColorSinglePrices
} from '@/data/glossyColorPricing';

interface CutItem {
  id: string;
  width: string;
  height: string;
  quantity: string;
}

interface YieldCalculatorProps {
  selectedQuality: string;
  selectedThickness: string;
  selectedSurface: string;
  selectedColor: string;
  selectedFactory: string;
  selectedProcessing: string;
  onBack?: () => void;
  onPanelSelect?: (panelData: {
    quality: string;
    thickness: string;
    size: string;
    quantity: number;
  }) => void;
}

const YieldCalculator: React.FC<YieldCalculatorProps> = ({
  selectedQuality,
  selectedThickness,
  selectedSurface,
  selectedColor,
  selectedFactory,
  selectedProcessing,
  onPanelSelect
}) => {
  const [cutItems, setCutItems] = useState<CutItem[]>([
    { id: '1', width: '', height: '', quantity: '' }
  ]);

  // 재단 항목 추가/제거 함수
  const addCutItem = () => {
    const newId = (Math.max(...cutItems.map(item => parseInt(item.id))) + 1).toString();
    setCutItems([...cutItems, { id: newId, width: '', height: '', quantity: '' }]);
  };

  const removeCutItem = (id: string) => {
    if (cutItems.length > 1) {
      setCutItems(cutItems.filter(item => item.id !== id));
    }
  };

  const updateCutItem = (id: string, field: keyof CutItem, value: string) => {
    setCutItems(cutItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
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

    // 원판 사이즈 매핑 (실제 치수)
    const sizeMapping: { [key: string]: { width: number; height: number } } = {
      '3*6': { width: 910, height: 1810 },
      '대3*6': { width: 950, height: 1860 },
      '4*5': { width: 1170, height: 1475 },
      '대4*5': { width: 1250, height: 1550 },
      '1*2': { width: 1050, height: 2050 },
      '4*6': { width: 1250, height: 1860 },
      '4*8': { width: 1250, height: 2450 },
      '4*10': { width: 1250, height: 3050 },
      '5*6': { width: 1550, height: 1850 },
      '5*8': { width: 1550, height: 2450 },
      '소3*6': { width: 910, height: 1810 }, // 소3*6은 3*6과 동일
      '소1*2': { width: 1050, height: 2050 }, // 소1*2는 1*2와 동일
      '5*5': { width: 1550, height: 1550 } // 5*5 추가 (정사각형)
    };

    const panelSizes = Array.from(allSizes).map(sizeStr => {
      let width, height;
      const sizeInfo = sizeMapping[sizeStr];
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

    return panelSizes.sort((a, b) => (a.width * a.height) - (b.width * b.height));
  }, [selectedThickness, selectedQuality]);

  // 통합 계산 훅 사용
  const { unifiedResults, totalQuantity, bestSingleRecommendation } = useUnifiedCalculation({
    cutItems,
    availablePanelSizes,
    maxResults: 10
  });

  const validCutItems = useMemo(() => {
    return cutItems.filter(item => 
      item.width && item.height && item.quantity &&
      parseFloat(item.width) > 0 && parseFloat(item.height) > 0 && parseInt(item.quantity) > 0
    );
  }, [cutItems]);

  // 에러 검증 함수들
  const validateCutItem = useCallback((item: CutItem) => {
    const width = parseFloat(item.width);
    const height = parseFloat(item.height);
    const quantity = parseInt(item.quantity);

    if (!item.width || !item.height || !item.quantity) {
      return { isValid: false, message: "모든 필드를 입력해주세요." };
    }
    
    if (isNaN(width) || width <= 0) {
      return { isValid: false, message: "가로 크기는 0보다 큰 숫자여야 합니다." };
    }
    
    if (isNaN(height) || height <= 0) {
      return { isValid: false, message: "세로 크기는 0보다 큰 숫자여야 합니다." };
    }
    
    if (isNaN(quantity) || quantity <= 0 || quantity !== Math.floor(quantity)) {
      return { isValid: false, message: "수량은 1 이상의 정수여야 합니다." };
    }

    return { isValid: true, message: "" };
  }, []);

  const validateAllItems = useCallback(() => {
    if (cutItems.length === 0) {
      return { isValid: false, message: "최소 1개의 재단 항목이 필요합니다." };
    }

    for (const item of cutItems) {
      const validation = validateCutItem(item);
      if (!validation.isValid) {
        return validation;
      }
    }

    return { isValid: true, message: "" };
  }, [cutItems, validateCutItem]);

  const handleCalculate = () => {
    const validation = validateAllItems();
    if (!validation.isValid) {
      toast.error(validation.message);
      return;
    }

    if (unifiedResults.length === 0) {
      toast.error("선택한 재질과 두께에서 해당 크기의 재단이 불가능합니다.");
      return;
    }

    toast.success("수율 계산이 완료되었습니다.");
  };

  const handlePanelSelect = (panelData: {
    quality: string;
    thickness: string;
    size: string;
    quantity: number;
  }) => {
    if (onPanelSelect) {
      onPanelSelect(panelData);
      toast.success(`${panelData.size} ${panelData.quantity}장이 견적에 추가되었습니다.`);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            재단 수율 계산기
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 현재 선택 상태 표시 */}
          <SelectionSummary 
            selectedQuality={selectedQuality}
            selectedThickness={selectedThickness}
            selectedSurface={selectedSurface}
            selectedColor={selectedColor}
            selectedFactory={selectedFactory}
            selectedProcessing={selectedProcessing}
          />

          {/* 재단 항목 입력 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">재단 항목</h3>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={addCutItem}
                className="flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                항목 추가
              </Button>
            </div>

            {cutItems.map((item, index) => (
              <div key={item.id} className="flex items-center gap-3 p-4 border border-border rounded-lg">
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor={`width-${item.id}`} className="text-sm font-medium">
                      가로 (mm)
                    </Label>
                    <Input
                      id={`width-${item.id}`}
                      type="number"
                      placeholder="0"
                      value={item.width}
                      onChange={(e) => updateCutItem(item.id, 'width', e.target.value)}
                      min="1"
                      step="1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`height-${item.id}`} className="text-sm font-medium">
                      세로 (mm)
                    </Label>
                    <Input
                      id={`height-${item.id}`}
                      type="number"
                      placeholder="0"
                      value={item.height}
                      onChange={(e) => updateCutItem(item.id, 'height', e.target.value)}
                      min="1"
                      step="1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`quantity-${item.id}`} className="text-sm font-medium">
                      수량 (개)
                    </Label>
                    <Input
                      id={`quantity-${item.id}`}
                      type="number"
                      placeholder="0"
                      value={item.quantity}
                      onChange={(e) => updateCutItem(item.id, 'quantity', e.target.value)}
                      min="1"
                      step="1"
                    />
                  </div>
                </div>
                {cutItems.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCutItem(item.id)}
                    className="text-destructive hover:text-destructive/90"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* 계산 버튼 */}
          <div className="flex justify-center">
            <Button 
              onClick={handleCalculate}
              className="flex items-center gap-2"
              disabled={validCutItems.length === 0}
            >
              <Calculator className="w-4 h-4" />
              수율 계산하기
            </Button>
          </div>

          {/* 총 수량 표시 */}
          {totalQuantity > 0 && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              총 재단 수량: <Badge variant="secondary">{totalQuantity}개</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 통합 추천 결과 */}
      {unifiedResults.length > 0 && (
        <UnifiedRecommendations
          unifiedResults={unifiedResults}
          cutItems={cutItems}
          onPanelSelect={handlePanelSelect}
          selectedQuality={selectedQuality}
          selectedThickness={selectedThickness}
          availablePanelSizes={availablePanelSizes}
          totalQuantity={totalQuantity}
          bestSingleRecommendation={bestSingleRecommendation}
        />
      )}
    </div>
  );
};

export default YieldCalculator;