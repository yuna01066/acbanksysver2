import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Calculator, Package, Plus, Trash2 } from "lucide-react";
import NestingThumbnail from "@/components/NestingThumbnail";
import UnifiedRecommendations from "@/components/UnifiedRecommendations";
import { calculatePanelCombinations } from "@/utils/panelCombinationCalculator";
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

  // 재단 항목 추가/제거 함수
  const addCutItem = () => {
    const newId = (Math.max(...cutItems.map(item => parseInt(item.id))) + 1).toString();
    setCutItems([...cutItems, {
      id: newId,
      width: '',
      height: '',
      quantity: ''
    }]);
  };
  const removeCutItem = (id: string) => {
    if (cutItems.length > 1) {
      setCutItems(cutItems.filter(item => item.id !== id));
    }
  };
  const updateCutItem = (id: string, field: keyof CutItem, value: string) => {
    setCutItems(cutItems.map(item => item.id === id ? {
      ...item,
      [field]: value
    } : item));
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
    };

    // 원판 사이즈 매핑 (10T~20T 기준 치수) - usePriceCalculation.ts와 일치
    const baseSizeMapping: {
      [key: string]: {
        width: number;
        height: number;
      };
    } = {
      '3*6': {
        width: 900,
        height: 1800
      },
      '대3*6': {
        width: 950,
        height: 1850
      },
      '4*5': {
        width: 1170,
        height: 1475
      },
      '대4*5': {
        width: 1250,
        height: 1550
      },
      '1*2': {
        width: 1050,
        height: 2050
      },
      '4*6': {
        width: 1250,
        height: 1900
      },
       '4*8': {
         width: 1200,
         height: 2400
       },
      '4*10': {
        width: 1250,
        height: 3050
      },
      '5*6': {
        width: 1550,
        height: 1850
      },
      '5*8': {
        width: 1550,
        height: 2450
      },
      '소3*6': {
        width: 900,
        height: 1800
      },
      '소1*2': {
        width: 1050,
        height: 2050
      },
      '5*5': {
        width: 1550,
        height: 1550
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

  // 복합 네스팅 알고리즘 - 여러 도형을 함께 배치
  const calculateMultiItemLayout = (items: Array<{
    width: number;
    height: number;
    quantity: number;
    id: string;
  }>, panelW: number, panelH: number): {
    positions: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      rotated: boolean;
      itemId: string;
    }>;
    totalPieces: number;
    canFitAll: boolean;
    placedCounts: {
      [key: string]: number;
    };
  } => {
    const MARGIN = 50; // 50mm 마진으로 통일
    const SPACING = 10; // 10mm 간격

    const usableWidth = panelW - MARGIN * 2;
    const usableHeight = panelH - MARGIN * 2;

    // 배치 결과를 저장할 배열들 초기화
    const positions: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      rotated: boolean;
      itemId: string;
    }> = [];
    const occupiedAreas: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];
    const placedCounts: {
      [key: string]: number;
    } = {};

    // 모든 도형을 크기 순(면적)으로 정렬하여 큰 것부터 배치
    const allPieces: Array<{
      width: number;
      height: number;
      itemId: string;
      originalIndex: number;
    }> = [];
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
    allPieces.sort((a, b) => b.width * b.height - a.width * a.height);

    // 위치가 겹치는지 확인하는 함수 (50mm 간격 포함)
    const isOverlapping = (x: number, y: number, w: number, h: number): boolean => {
      const minGap = SPACING; // 50mm 간격
      return occupiedAreas.some(area => !(x >= area.x + area.width + minGap || x + w + minGap <= area.x || y >= area.y + area.height + minGap || y + h + minGap <= area.y));
    };

    // 각 도형 배치 시도 - 회전을 고려한 최적 배치
    for (const piece of allPieces) {
      let placed = false;
      let bestPosition = null;
      let bestScore = -1;

      // 가능한 배치 위치와 회전 시도 (더 체계적인 평가)
      const orientations = [{
        width: piece.width,
        height: piece.height,
        rotated: false
      }, {
        width: piece.height,
        height: piece.width,
        rotated: true
      }];

      // 각 방향에 대해 가능한 모든 위치 평가
      for (const orientation of orientations) {
        // 사용 가능한 영역에 들어가는지 확인
        if (orientation.width > usableWidth || orientation.height > usableHeight) continue;

        // 가능한 모든 위치에서 배치 시도 (10mm 간격으로 더 세밀하게 검색)
        for (let y = MARGIN; y <= MARGIN + usableHeight - orientation.height; y += 10) {
          for (let x = MARGIN; x <= MARGIN + usableWidth - orientation.width; x += 10) {
            if (!isOverlapping(x, y, orientation.width, orientation.height)) {
              // 이 위치의 점수 계산 (왼쪽 위부터 우선, 회전하지 않은 것을 약간 선호)
              const positionScore = calculatePositionScore(x, y, orientation, usableWidth, usableHeight);
              if (positionScore > bestScore) {
                bestScore = positionScore;
                bestPosition = {
                  x,
                  y,
                  width: orientation.width,
                  height: orientation.height,
                  rotated: orientation.rotated
                };
              }
            }
          }
        }
      }

      // 최적 위치에 배치
      if (bestPosition) {
        positions.push({
          x: bestPosition.x,
          y: bestPosition.y,
          width: bestPosition.width,
          height: bestPosition.height,
          rotated: bestPosition.rotated,
          itemId: piece.itemId
        });
        occupiedAreas.push({
          x: bestPosition.x,
          y: bestPosition.y,
          width: bestPosition.width,
          height: bestPosition.height
        });

        // 배치된 개수 카운트
        placedCounts[piece.itemId] = (placedCounts[piece.itemId] || 0) + 1;
        placed = true;
      }

      // 배치하지 못한 도형이 있으면 중단
      if (!placed) {
        break;
      }
    }

    // 배치 점수 계산 함수
    function calculatePositionScore(x: number, y: number, orientation: {
      width: number;
      height: number;
      rotated: boolean;
    }, maxWidth: number, maxHeight: number): number {
      // 기본 점수: 왼쪽 위부터 우선 (거리 기반)
      const distanceScore = Math.sqrt((x - MARGIN) ** 2 + (y - MARGIN) ** 2);
      let score = 10000 - distanceScore;

      // 회전하지 않은 방향을 약간 선호 (같은 위치라면)
      if (!orientation.rotated) {
        score += 5;
      }

      // 가장자리에 가까운 배치 선호 (공간 효율성)
      const edgeBonus = Math.min(x - MARGIN, y - MARGIN, maxWidth - (x - MARGIN) - orientation.width, maxHeight - (y - MARGIN) - orientation.height);
      if (edgeBonus < SPACING) {
        score += 10;
      }
      return score;
    }
    return {
      positions,
      totalPieces: positions.length,
      canFitAll: positions.length === allPieces.length,
      placedCounts
    };
  };

  // 복합 네스팅을 사용한 수율 계산 함수
  const calculateYield = (items: Array<{
    width: number;
    height: number;
    quantity: number;
    id: string;
  }>, panelW: number, panelH: number): {
    piecesPerPanel: number;
    efficiency: number;
    wasteArea: number;
    canFitAll: boolean;
    panelsNeeded: number;
    placedCounts: {
      [key: string]: number;
    };
  } => {
    let remainingItems = [...items];
    let totalPanelsNeeded = 0;
    let allPlacedCounts: {
      [key: string]: number;
    } = {};
    let allCanFit = true;

    // 각 도형이 원판에 물리적으로 들어갈 수 있는지 먼저 확인
    for (const item of items) {
      const usableWidth = panelW - 100; // 마진 50*2
      const usableHeight = panelH - 100; // 마진 50*2

      // 회전 포함해서 들어갈 수 있는지 확인
      const canFitNormally = item.width <= usableWidth && item.height <= usableHeight;
      const canFitRotated = item.height <= usableWidth && item.width <= usableHeight;
      if (!canFitNormally && !canFitRotated) {
        allCanFit = false;
        break;
      }
    }
    if (!allCanFit) {
      return {
        piecesPerPanel: 0,
        efficiency: 0,
        wasteArea: panelW * panelH,
        canFitAll: false,
        panelsNeeded: 0,
        placedCounts: {}
      };
    }

    // 여러 판에 걸쳐 배치 시뮬레이션
    while (remainingItems.some(item => item.quantity > 0)) {
      const itemsToPlace = remainingItems.filter(item => item.quantity > 0);
      if (itemsToPlace.length === 0) break;
      const {
        totalPieces,
        placedCounts
      } = calculateMultiItemLayout(itemsToPlace, panelW, panelH);
      if (totalPieces === 0) {
        // 더 이상 배치할 수 없음
        break;
      }
      totalPanelsNeeded++;

      // 전체 배치 카운트 누적
      Object.entries(placedCounts).forEach(([itemId, count]) => {
        allPlacedCounts[itemId] = (allPlacedCounts[itemId] || 0) + count;
      });

      // 수량 업데이트
      remainingItems = remainingItems.map(item => ({
        ...item,
        quantity: Math.max(0, item.quantity - (placedCounts[item.id] || 0))
      }));

      // 무한 루프 방지
      if (totalPanelsNeeded > 50) break;
    }
    const totalRequired = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPlaced = Object.values(allPlacedCounts).reduce((sum, count) => sum + count, 0);
    const totalRequiredArea = items.reduce((sum, item) => sum + item.width * item.height * item.quantity, 0);
    const totalPanelArea = panelW * panelH * totalPanelsNeeded;
    const efficiency = totalPanelArea > 0 ? totalRequiredArea / totalPanelArea * 100 : 0;
    const wasteArea = totalPanelArea - totalRequiredArea;
    const avgPiecesPerPanel = totalPanelsNeeded > 0 ? Math.round(totalPlaced / totalPanelsNeeded) : 0;
    return {
      piecesPerPanel: avgPiecesPerPanel,
      efficiency,
      wasteArea,
      canFitAll: totalPlaced >= totalRequired,
      panelsNeeded: totalPanelsNeeded,
      placedCounts: allPlacedCounts
    };
  };

  // 수율 결과 계산
  const yieldResults = useMemo(() => {
    // 모든 재단 항목이 유효한지 확인
    const validCutItems = cutItems.filter(item => item.width && item.height && item.quantity && parseFloat(item.width) > 0 && parseFloat(item.height) > 0 && parseInt(item.quantity) > 0);
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
      const {
        canFitAll,
        efficiency,
        wasteArea,
        panelsNeeded,
        piecesPerPanel
      } = calculateYield(itemsForNesting, panel.width, panel.height);

      // 모든 도형이 배치되지 않으면 제외
      if (!canFitAll) {
        return null;
      }
      const totalPieces = totalRequired;
      const surplus = piecesPerPanel * panelsNeeded - totalRequired; // 실제 생산량 - 필요량

      return {
        panelSize: panel.name,
        panelWidth: panel.width,
        panelHeight: panel.height,
        piecesPerPanel,
        panelsNeeded,
        totalPieces,
        efficiency,
        wasteArea,
        surplus: Math.max(0, surplus)
      };
    }).filter(result => result !== null && result.piecesPerPanel > 0);

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

  // 복합 조합 계산
  const panelCombinations = useMemo(() => {
    const validCutItems = cutItems.filter(item => item.width && item.height && item.quantity && parseFloat(item.width) > 0 && parseFloat(item.height) > 0 && parseInt(item.quantity) > 0);
    if (validCutItems.length === 0) return [];
    const itemsForNesting = validCutItems.map((item, index) => ({
      width: parseFloat(item.width),
      height: parseFloat(item.height),
      quantity: parseInt(item.quantity),
      id: `item-${index}`
    }));
    return calculatePanelCombinations(itemsForNesting, availablePanelSizes);
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
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">재단할 도형 정보</Label>
              <Button variant="outline" size="sm" onClick={addCutItem} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                추가
              </Button>
            </div>
            
            {cutItems.map((item, index) => <div key={item.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-border rounded-xl bg-background/50">
                <div className="space-y-2">
                  <Label htmlFor={`width-${item.id}`}>가로 (mm)</Label>
                  <Input id={`width-${item.id}`} type="number" placeholder="예: 300" value={item.width} onChange={e => updateCutItem(item.id, 'width', e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`height-${item.id}`}>세로 (mm)</Label>
                  <Input id={`height-${item.id}`} type="number" placeholder="예: 200" value={item.height} onChange={e => updateCutItem(item.id, 'height', e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`quantity-${item.id}`}>수량 (개)</Label>
                  <Input id={`quantity-${item.id}`} type="number" placeholder="예: 50" value={item.quantity} onChange={e => updateCutItem(item.id, 'quantity', e.target.value)} className="rounded-xl" />
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
        </CardContent>
      </Card>

      {/* 통합 추천 결과 */}
      {(yieldResults.length > 0 || panelCombinations.length > 0) && <UnifiedRecommendations yieldResults={yieldResults} combinations={panelCombinations} cutItems={cutItems} onPanelSelect={onPanelSelect} selectedQuality={selectedQuality} selectedThickness={selectedThickness} availablePanelSizes={availablePanelSizes} />}

      {cutItems.some(item => item.width && item.height && item.quantity) && yieldResults.length === 0 && panelCombinations.length === 0 && <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              입력하신 크기로는 선택된 두께에서 생산 가능한 원판이 없습니다.
              <br />
              더 작은 크기로 입력하거나 다른 두께를 선택해주세요.
            </p>
          </CardContent>
        </Card>}
    </div>;
};
export default YieldCalculator;