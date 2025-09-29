import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Calculator, Package } from "lucide-react";
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
  const [cutWidth, setCutWidth] = useState<string>('');
  const [cutHeight, setCutHeight] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [selectedThickness, setSelectedThickness] = useState<string>('3T');
  const [selectedQuality, setSelectedQuality] = useState<string>('glossy-color');

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

    // 사이즈를 실제 치수로 변환
    const panelSizes: PanelSize[] = Array.from(allSizes).map(sizeStr => {
      const parts = sizeStr.replace(/[소대]/g, '').split('*');
      const width = parseFloat(parts[0]) * 1000; // m를 mm로 변환
      const height = parseFloat(parts[1]) * 1000;
      
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

  // 수율 계산 함수 (마진과 간격 고려)
  const calculateYield = (
    cutW: number, 
    cutH: number, 
    qty: number, 
    panelW: number, 
    panelH: number
  ): { piecesPerPanel: number; efficiency: number; wasteArea: number } => {
    // 원판 마진 80mm (각 면에서 80mm씩 제거)
    const MARGIN = 80;
    const SPACING = 50; // 도형 간 최소 간격
    
    const usableWidth = panelW - (MARGIN * 2);
    const usableHeight = panelH - (MARGIN * 2);
    
    // 사용 가능한 영역이 도형보다 작으면 배치 불가
    if (usableWidth < cutW || usableHeight < cutH) {
      return { piecesPerPanel: 0, efficiency: 0, wasteArea: panelW * panelH };
    }
    
    // 90도 회전을 고려한 최적 배치 계산 (간격 포함)
    const layout1 = {
      horizontal: Math.floor((usableWidth + SPACING) / (cutW + SPACING)),
      vertical: Math.floor((usableHeight + SPACING) / (cutH + SPACING))
    };
    
    const layout2 = {
      horizontal: Math.floor((usableWidth + SPACING) / (cutH + SPACING)),
      vertical: Math.floor((usableHeight + SPACING) / (cutW + SPACING))
    };

    const pieces1 = layout1.horizontal * layout1.vertical;
    const pieces2 = layout2.horizontal * layout2.vertical;
    
    const piecesPerPanel = Math.max(pieces1, pieces2);
    const usedArea = piecesPerPanel * cutW * cutH;
    const totalArea = panelW * panelH;
    const efficiency = totalArea > 0 ? (usedArea / totalArea) * 100 : 0;
    const wasteArea = totalArea - usedArea;

    return { piecesPerPanel, efficiency, wasteArea };
  };

  // 수율 결과 계산
  const yieldResults = useMemo(() => {
    if (!cutWidth || !cutHeight || !quantity) return [];

    const cutW = parseFloat(cutWidth);
    const cutH = parseFloat(cutHeight);
    const qty = parseInt(quantity);

    if (cutW <= 0 || cutH <= 0 || qty <= 0) return [];

    const results: YieldResult[] = availablePanelSizes.map(panel => {
      const { piecesPerPanel, efficiency, wasteArea } = calculateYield(
        cutW, cutH, qty, panel.width, panel.height
      );

      const panelsNeeded = piecesPerPanel > 0 ? Math.ceil(qty / piecesPerPanel) : 0;
      const totalPieces = panelsNeeded * piecesPerPanel;
      const surplus = totalPieces - qty; // 여분 계산

      return {
        panelSize: panel.name,
        panelWidth: panel.width,
        panelHeight: panel.height,
        piecesPerPanel,
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
  }, [cutWidth, cutHeight, quantity, availablePanelSizes]);

  const availableThicknesses = useMemo(() => {
    const priceData = getPriceDataByQuality(selectedQuality);
    const thicknesses = new Set<string>();
    Object.keys(priceData).forEach(thickness => thicknesses.add(thickness));
    return Array.from(thicknesses).sort((a, b) => parseFloat(a) - parseFloat(b));
  }, [selectedQuality]);

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
            <div className="space-y-2">
              <Label htmlFor="cutWidth">가로 (mm)</Label>
              <Input
                id="cutWidth"
                type="number"
                placeholder="예: 300"
                value={cutWidth}
                onChange={(e) => setCutWidth(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cutHeight">세로 (mm)</Label>
              <Input
                id="cutHeight"
                type="number"
                placeholder="예: 200"
                value={cutHeight}
                onChange={(e) => setCutHeight(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">수량 (개)</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="예: 50"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="rounded-xl"
              />
            </div>
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
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
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
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-semibold text-primary-dark">
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
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">판당 개수</div>
                      <div className="font-medium">{result.piecesPerPanel}개</div>
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
                      <div className="text-muted-foreground">판당 폐기면적</div>
                      <div className="font-medium">
                        {(result.wasteArea / 1000000).toFixed(2)}㎡
                      </div>
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
                      여분 없이 정확히 {quantity}개 생산됩니다
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {cutWidth && cutHeight && quantity && yieldResults.length === 0 && (
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