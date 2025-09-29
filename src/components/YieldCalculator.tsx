import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Calculator, Package, Plus, Trash2 } from "lucide-react";
import NestingThumbnail from "@/components/NestingThumbnail";
import { 
  glossyColorSinglePrices, 
  glossyStandardSinglePrices, 
  astelColorSinglePrices, 
  satinColorSinglePrices 
} from "@/data/glossyColorPricing";
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

const YieldCalculator: React.FC<YieldCalculatorProps> = ({ onBack, onPanelSelect }) => {
  const [cutItems, setCutItems] = useState<CutItem[]>([
    { id: '1', width: '', height: '', quantity: '' }
  ]);
  const [selectedThickness, setSelectedThickness] = useState<string>('3T');
  const [selectedQuality, setSelectedQuality] = useState<string>('glossy-color');

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

    return panelSizes.sort((a, b) => (a.width * a.height) - (b.width * b.height));
  }, [selectedThickness, selectedQuality]);

  // 복합 네스팅 알고리즘 - 여러 도형을 함께 배치
  const calculateMultiItemLayout = (
    items: Array<{ width: number; height: number; quantity: number; id: string }>,
    panelW: number,
    panelH: number
  ): { 
    positions: Array<{ x: number; y: number; width: number; height: number; rotated: boolean; itemId: string }>;
    totalPieces: number;
    canFitAll: boolean;
  } => {
    const MARGIN = 80;
    const SPACING = 50;
    
    const usableWidth = panelW - (MARGIN * 2);
    const usableHeight = panelH - (MARGIN * 2);
    
    // 모든 도형을 크기 순(면적)으로 정렬하여 큰 것부터 배치
    const allPieces: Array<{ width: number; height: number; itemId: string; originalIndex: number }> = [];
    items.forEach((item, index) => {
      for (let i = 0; i < item.quantity; i++) {
        allPieces.push({
          width: item.width,
          height: item.height,
          itemId: item.id,
          originalIndex: index
        });
      }
    });
    
    // 면적 기준으로 내림차순 정렬
    allPieces.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    
    const positions: Array<{ x: number; y: number; width: number; height: number; rotated: boolean; itemId: string }> = [];
    const occupiedAreas: Array<{ x: number; y: number; width: number; height: number }> = [];
    
    // 위치가 겹치는지 확인하는 함수
    const isOverlapping = (x: number, y: number, w: number, h: number): boolean => {
      return occupiedAreas.some(area => 
        !(x >= area.x + area.width || x + w <= area.x || y >= area.y + area.height || y + h <= area.y)
      );
    };
    
    // 각 도형 배치 시도
    for (const piece of allPieces) {
      let placed = false;
      
      // 가능한 배치 위치와 회전 시도
      const orientations = [
        { width: piece.width, height: piece.height, rotated: false },
        { width: piece.height, height: piece.width, rotated: true }
      ];
      
      for (const orientation of orientations) {
        if (placed) break;
        
        // 사용 가능한 영역에 들어가는지 확인
        if (orientation.width > usableWidth || orientation.height > usableHeight) continue;
        
        // 가능한 모든 위치에서 배치 시도 (격자 방식)
        const stepX = Math.max(20, orientation.width / 4); // 더 세밀한 배치를 위해
        const stepY = Math.max(20, orientation.height / 4);
        
        for (let y = MARGIN; y <= MARGIN + usableHeight - orientation.height && !placed; y += stepY) {
          for (let x = MARGIN; x <= MARGIN + usableWidth - orientation.width && !placed; x += stepX) {
            if (!isOverlapping(x, y, orientation.width, orientation.height)) {
              // 배치 가능한 위치 발견
              positions.push({
                x,
                y,
                width: orientation.width,
                height: orientation.height,
                rotated: orientation.rotated,
                itemId: piece.itemId
              });
              
              occupiedAreas.push({
                x: x - SPACING / 2,
                y: y - SPACING / 2,
                width: orientation.width + SPACING,
                height: orientation.height + SPACING
              });
              
              placed = true;
            }
          }
        }
      }
      
      // 배치하지 못한 도형이 있으면 중단
      if (!placed) {
        break;
      }
    }
    
    return {
      positions,
      totalPieces: positions.length,
      canFitAll: positions.length === allPieces.length
    };
  };

  // 수율 계산 함수 (복합 네스팅 사용)
  const calculateYield = (
    items: Array<{ width: number; height: number; quantity: number; id: string }>,
    panelW: number, 
    panelH: number
  ): { piecesPerPanel: number; efficiency: number; wasteArea: number; canFitAll: boolean } => {
    const { totalPieces, canFitAll } = calculateMultiItemLayout(items, panelW, panelH);
    
    if (!canFitAll) {
      return { piecesPerPanel: 0, efficiency: 0, wasteArea: panelW * panelH, canFitAll: false };
    }
    
    const totalRequiredArea = items.reduce((sum, item) => sum + (item.width * item.height * item.quantity), 0);
    const totalArea = panelW * panelH;
    const efficiency = totalArea > 0 ? (totalRequiredArea / totalArea) * 100 : 0;
    const wasteArea = totalArea - totalRequiredArea;

    return { piecesPerPanel: totalPieces, efficiency, wasteArea, canFitAll: true };
  };

  // 수율 결과 계산
  const yieldResults = useMemo(() => {
    // 모든 재단 항목이 유효한지 확인
    const validCutItems = cutItems.filter(item => 
      item.width && item.height && item.quantity &&
      parseFloat(item.width) > 0 && parseFloat(item.height) > 0 && parseInt(item.quantity) > 0
    );

    if (validCutItems.length === 0) return [];

    // 복합 네스팅을 위한 아이템 배열 생성
    const itemsForNesting = validCutItems.map((item, index) => ({
      width: parseFloat(item.width),
      height: parseFloat(item.height),
      quantity: parseInt(item.quantity),
      id: `item-${index}`
    }));

    const totalRequired = itemsForNesting.reduce((sum, item) => sum + item.quantity, 0);

    const results: YieldResult[] = availablePanelSizes.map(panel => {
      const { canFitAll, efficiency, wasteArea } = calculateYield(itemsForNesting, panel.width, panel.height);
      
      if (!canFitAll) {
        return {
          panelSize: panel.name,
          panelWidth: panel.width,
          panelHeight: panel.height,
          piecesPerPanel: 0,
          panelsNeeded: 0,
          totalPieces: 0,
          efficiency: 0,
          wasteArea: panel.width * panel.height,
          surplus: 0
        };
      }

      // 한 판에 모든 필요 수량이 들어갈 수 있으므로 1장만 필요
      const panelsNeeded = 1;
      const totalPieces = totalRequired;
      const surplus = 0; // 정확히 필요한 수량만 생산

      return {
        panelSize: panel.name,
        panelWidth: panel.width,
        panelHeight: panel.height,
        piecesPerPanel: totalPieces,
        panelsNeeded,
        totalPieces,
        efficiency,
        wasteArea,
        surplus
      };
    }).filter(result => result.piecesPerPanel > 0);

    // 여분이 적을수록, 효율성이 높을수록, 필요 판수가 적을수록 우선
    return results.sort((a, b) => {
      // 1순위: 여분이 적을수록 좋음
      if (a.surplus !== b.surplus) {
        return a.surplus - b.surplus;
      }
      // 2순위: 효율성이 높을수록 좋음
      if (Math.abs(a.efficiency - b.efficiency) > 1) {
        return b.efficiency - a.efficiency;
      }
      // 3순위: 필요 판수가 적을수록 좋음
      return a.panelsNeeded - b.panelsNeeded;
    });
  }, [cutItems, availablePanelSizes]);

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

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          onClick={onBack}
          className="p-2"
        >
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
            <span className="text-xs text-muted-foreground">※ 원판 마진 80mm, 도형 간 간격 50mm가 자동 적용됩니다</span>
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
              <select 
                id="quality"
                value={selectedQuality}
                onChange={(e) => setSelectedQuality(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-background focus:border-primary focus:outline-none"
              >
                {CASTING_QUALITIES.map(quality => (
                  <option key={quality.id} value={quality.id}>{quality.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="thickness">두께</Label>
              <select 
                id="thickness"
                value={selectedThickness}
                onChange={(e) => setSelectedThickness(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-background focus:border-primary focus:outline-none"
              >
                {availableThicknesses.map(thickness => (
                  <option key={thickness} value={thickness}>{thickness}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">재단할 도형 정보</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={addCutItem}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                추가
              </Button>
            </div>
            
            {cutItems.map((item, index) => (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-border rounded-xl bg-background/50">
                <div className="space-y-2">
                  <Label htmlFor={`width-${item.id}`}>가로 (mm)</Label>
                  <Input
                    id={`width-${item.id}`}
                    type="number"
                    placeholder="예: 300"
                    value={item.width}
                    onChange={(e) => updateCutItem(item.id, 'width', e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`height-${item.id}`}>세로 (mm)</Label>
                  <Input
                    id={`height-${item.id}`}
                    type="number"
                    placeholder="예: 200"
                    value={item.height}
                    onChange={(e) => updateCutItem(item.id, 'height', e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`quantity-${item.id}`}>수량 (개)</Label>
                  <Input
                    id={`quantity-${item.id}`}
                    type="number"
                    placeholder="예: 50"
                    value={item.quantity}
                    onChange={(e) => updateCutItem(item.id, 'quantity', e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground font-medium">
                      도형 {index + 1}
                    </span>
                    {cutItems.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCutItem(item.id)}
                        className="p-1 h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {yieldResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-title flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              수율 계산 결과
            </CardTitle>
            <p className="text-body">
              여분이 적을수록, 효율성이 높을수록, 필요 판수가 적을수록 우선 정렬됩니다
              <br />
              * 견적계산기로 이동 할 경우 원판 수량이 저장되지 않으니 수량을 꼭 기억 해 주세요
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {yieldResults.map((result, index) => (
                <div 
                  key={result.panelSize}
                  className={`p-4 rounded-xl border transition-all duration-200 ${
                    index === 0 
                      ? 'border-primary/30 bg-primary/5 shadow-smooth' 
                      : 'border-border/50 bg-background/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <NestingThumbnail
                          cutItems={cutItems}
                          panelWidth={result.panelWidth}
                          panelHeight={result.panelHeight}
                          panelsNeeded={result.panelsNeeded}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">
                            {result.panelSize} 원판
                            {index === 0 && (
                              <span className="ml-2 px-2 py-1 text-xs bg-primary text-primary-foreground rounded-full">
                                추천
                              </span>
                            )}
                          </h4>
                          <span className="text-caption">
                            ({result.panelWidth}mm × {result.panelHeight}mm)
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">총 필요 수량</div>
                            <div className="font-medium">{totalQuantity}개</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">총 생산량</div>
                            <div className="font-medium">{result.totalPieces}개</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">수율</div>
                            <div className="font-medium">{result.efficiency.toFixed(1)}%</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">총 폐기면적</div>
                            <div className="font-medium">
                              {(result.wasteArea / 1000000).toFixed(2)}㎡
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-semibold text-foreground">
                          {result.panelsNeeded}장 필요
                        </div>
                      </div>
                      {onPanelSelect && (
                        <Button
                          variant="minimal"
                          size="sm"
                          onClick={() => onPanelSelect({
                            quality: selectedQuality,
                            thickness: selectedThickness,
                            size: result.panelSize,
                            quantity: result.panelsNeeded
                          })}
                          className="whitespace-nowrap"
                        >
                          견적계산기로
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {result.surplus > 0 && (
                    <div className="mt-3 p-2 bg-warning/10 text-muted-foreground text-sm rounded-lg">
                      <span className="font-medium">여분 생산:</span> 
                      {result.surplus}개 추가 생산됩니다
                    </div>
                  )}
                  
                  {result.surplus === 0 && (
                    <div className="mt-3 p-2 bg-success/10 text-muted-foreground text-sm rounded-lg">
                      <span className="font-medium">정확한 수량:</span> 
                      여분 없이 정확히 {totalQuantity}개 생산됩니다
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {cutItems.some(item => item.width && item.height && item.quantity) && yieldResults.length === 0 && (
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
    </div>
  );
};

export default YieldCalculator;