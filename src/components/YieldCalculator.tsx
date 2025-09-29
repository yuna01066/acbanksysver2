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
}

interface YieldCalculatorProps {
  onBack: () => void;
}

const YieldCalculator: React.FC<YieldCalculatorProps> = ({ onBack }) => {
  const [cutWidth, setCutWidth] = useState<string>('');
  const [cutHeight, setCutHeight] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [selectedThickness, setSelectedThickness] = useState<string>('3T');

  // 모든 가격 데이터에서 사용 가능한 원판 사이즈 추출
  const availablePanelSizes = useMemo(() => {
    const allSizes = new Set<string>();
    
    // 모든 가격 데이터에서 사이즈 수집
    [glossyColorSinglePrices, glossyStandardSinglePrices, astelColorSinglePrices, satinColorSinglePrices]
      .forEach(priceData => {
        Object.values(priceData).forEach(thicknessData => {
          Object.keys(thicknessData).forEach(size => allSizes.add(size));
        });
      });

    // 사이즈를 실제 치수로 변환
    const panelSizes: PanelSize[] = Array.from(allSizes).map(sizeStr => {
      const parts = sizeStr.replace(/[소대]/g, '').split('*');
      const width = parseFloat(parts[0]) * 1000; // m를 mm로 변환
      const height = parseFloat(parts[1]) * 1000;
      
      // 선택된 두께에서 해당 사이즈가 사용 가능한지 확인
      const isAvailable = [
        glossyColorSinglePrices,
        glossyStandardSinglePrices, 
        astelColorSinglePrices,
        satinColorSinglePrices
      ].some(priceData => 
        priceData[selectedThickness] && priceData[selectedThickness][sizeStr]
      );

      return {
        name: sizeStr,
        width,
        height,
        available: isAvailable
      };
    }).filter(panel => panel.available);

    return panelSizes.sort((a, b) => (a.width * a.height) - (b.width * b.height));
  }, [selectedThickness]);

  // 수율 계산 함수
  const calculateYield = (
    cutW: number, 
    cutH: number, 
    qty: number, 
    panelW: number, 
    panelH: number
  ): { piecesPerPanel: number; efficiency: number; wasteArea: number } => {
    // 90도 회전을 고려한 최적 배치 계산
    const layout1 = {
      horizontal: Math.floor(panelW / cutW),
      vertical: Math.floor(panelH / cutH)
    };
    
    const layout2 = {
      horizontal: Math.floor(panelW / cutH),
      vertical: Math.floor(panelH / cutW)
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

      return {
        panelSize: panel.name,
        panelWidth: panel.width,
        panelHeight: panel.height,
        piecesPerPanel,
        panelsNeeded,
        totalPieces,
        efficiency,
        wasteArea
      };
    }).filter(result => result.piecesPerPanel > 0);

    // 효율성과 필요 판수를 종합적으로 고려한 정렬
    return results.sort((a, b) => {
      // 효율성이 높을수록, 필요 판수가 적을수록 우선
      const scoreA = a.efficiency - (a.panelsNeeded * 5);
      const scoreB = b.efficiency - (b.panelsNeeded * 5);
      return scoreB - scoreA;
    });
  }, [cutWidth, cutHeight, quantity, availablePanelSizes]);

  const availableThicknesses = useMemo(() => {
    const thicknesses = new Set<string>();
    [glossyColorSinglePrices, glossyStandardSinglePrices, astelColorSinglePrices, satinColorSinglePrices]
      .forEach(priceData => {
        Object.keys(priceData).forEach(thickness => thicknesses.add(thickness));
      });
    return Array.from(thicknesses).sort((a, b) => parseFloat(a) - parseFloat(b));
  }, []);

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
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-title">재단 정보 입력</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <p className="text-caption">
              효율성과 필요 판수를 고려하여 최적순으로 정렬됩니다
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
                    <div className="text-right">
                      <div className="font-semibold text-primary">
                        {result.panelsNeeded}장 필요
                      </div>
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
                  
                  {result.totalPieces > parseInt(quantity || '0') && (
                    <div className="mt-3 p-2 bg-warning/10 text-warning-foreground text-sm rounded-lg">
                      <span className="font-medium">여분 생산:</span> 
                      {result.totalPieces - parseInt(quantity || '0')}개 추가 생산됩니다
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