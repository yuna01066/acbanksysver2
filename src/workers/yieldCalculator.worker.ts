// Web Worker for heavy yield calculations
import { glossyColorSinglePrices, glossyStandardSinglePrices, astelColorSinglePrices, satinColorSinglePrices } from "@/data/glossyColorPricing";

interface PanelSize {
  name: string;
  width: number;
  height: number;
  available: boolean;
}

interface CutItem {
  width: number;
  height: number;
  quantity: number;
  id: string;
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
  surplus: number;
}

interface CalculationRequest {
  type: 'calculate';
  items: CutItem[];
  panelSizes: PanelSize[];
  thickness: string;
  quality: string;
}

interface ProgressMessage {
  type: 'progress';
  progress: number;
}

interface ResultMessage {
  type: 'result';
  yieldResults: YieldResult[];
  combinations: any[];
}

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

// 복합 네스팅 알고리즘 - 여러 도형을 함께 배치
const calculateMultiItemLayout = (
  items: CutItem[],
  panelW: number,
  panelH: number,
  thickness: string
): {
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
  placedCounts: { [key: string]: number };
} => {
  const MARGIN = 0;
  
  const thicknessValue = parseFloat(thickness?.replace('T', '') || '0');
  const SPACING = thicknessValue < 10 ? 6 : 8;

  const usableWidth = panelW - MARGIN * 2;
  const usableHeight = panelH - MARGIN * 2;

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
  const placedCounts: { [key: string]: number } = {};

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

  allPieces.sort((a, b) => b.width * b.height - a.width * a.height);

  const isOverlapping = (x: number, y: number, w: number, h: number): boolean => {
    const minGap = SPACING;
    return occupiedAreas.some(
      area =>
        !(
          x >= area.x + area.width + minGap ||
          x + w + minGap <= area.x ||
          y >= area.y + area.height + minGap ||
          y + h + minGap <= area.y
        )
    );
  };

  const calculatePositionScore = (
    x: number,
    y: number,
    orientation: { width: number; height: number; rotated: boolean },
    maxWidth: number,
    maxHeight: number
  ): number => {
    const distanceScore = Math.sqrt((x - MARGIN) ** 2 + (y - MARGIN) ** 2);
    let score = 10000 - distanceScore;

    if (!orientation.rotated) {
      score += 5;
    }

    const edgeBonus = Math.min(
      x - MARGIN,
      y - MARGIN,
      maxWidth - (x - MARGIN) - orientation.width,
      maxHeight - (y - MARGIN) - orientation.height
    );
    if (edgeBonus < SPACING) {
      score += 10;
    }
    return score;
  };

  for (const piece of allPieces) {
    let bestPosition = null;
    let bestScore = -1;

    const orientations = [
      { width: piece.width, height: piece.height, rotated: false },
      { width: piece.height, height: piece.width, rotated: true }
    ];

    for (const orientation of orientations) {
      if (orientation.width > usableWidth || orientation.height > usableHeight) continue;

      for (let y = MARGIN; y <= MARGIN + usableHeight - orientation.height; y += 10) {
        for (let x = MARGIN; x <= MARGIN + usableWidth - orientation.width; x += 10) {
          if (!isOverlapping(x, y, orientation.width, orientation.height)) {
            const positionScore = calculatePositionScore(
              x,
              y,
              orientation,
              usableWidth,
              usableHeight
            );
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

      placedCounts[piece.itemId] = (placedCounts[piece.itemId] || 0) + 1;
    } else {
      break;
    }
  }

  return {
    positions,
    totalPieces: positions.length,
    canFitAll: positions.length === allPieces.length,
    placedCounts
  };
};

// 복합 네스팅을 사용한 수율 계산 함수
const calculateYield = (
  items: CutItem[],
  panelW: number,
  panelH: number,
  thickness: string
): {
  piecesPerPanel: number;
  efficiency: number;
  wasteArea: number;
  canFitAll: boolean;
  panelsNeeded: number;
  placedCounts: { [key: string]: number };
} => {
  let remainingItems = [...items];
  let totalPanelsNeeded = 0;
  let allPlacedCounts: { [key: string]: number } = {};
  let allCanFit = true;

  for (const item of items) {
    const usableWidth = panelW - 100;
    const usableHeight = panelH - 100;

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

  while (remainingItems.some(item => item.quantity > 0)) {
    const itemsToPlace = remainingItems.filter(item => item.quantity > 0);
    if (itemsToPlace.length === 0) break;

    const { totalPieces, placedCounts } = calculateMultiItemLayout(
      itemsToPlace,
      panelW,
      panelH,
      thickness
    );

    if (totalPieces === 0) {
      break;
    }

    totalPanelsNeeded++;

    Object.entries(placedCounts).forEach(([itemId, count]) => {
      allPlacedCounts[itemId] = (allPlacedCounts[itemId] || 0) + count;
    });

    remainingItems = remainingItems.map(item => ({
      ...item,
      quantity: Math.max(0, item.quantity - (placedCounts[item.id] || 0))
    }));

    if (totalPanelsNeeded > 50) break;
  }

  const totalRequired = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPlaced = Object.values(allPlacedCounts).reduce((sum, count) => sum + count, 0);
  const totalRequiredArea = items.reduce(
    (sum, item) => sum + item.width * item.height * item.quantity,
    0
  );
  const totalPanelArea = panelW * panelH * totalPanelsNeeded;
  const efficiency = totalPanelArea > 0 ? (totalRequiredArea / totalPanelArea) * 100 : 0;
  const wasteArea = totalPanelArea - totalRequiredArea;
  const avgPiecesPerPanel =
    totalPanelsNeeded > 0 ? Math.round(totalPlaced / totalPanelsNeeded) : 0;

  return {
    piecesPerPanel: avgPiecesPerPanel,
    efficiency,
    wasteArea,
    canFitAll: totalPlaced >= totalRequired,
    panelsNeeded: totalPanelsNeeded,
    placedCounts: allPlacedCounts
  };
};

// 간단한 조합 계산 (panelCombinationCalculator 대체)
const calculateSimpleCombinations = (
  items: CutItem[],
  panelSizes: PanelSize[],
  maxCombinations: number,
  thickness: string
): any[] => {
  // 기본적인 조합 생성 로직
  const combinations: any[] = [];
  
  // 단일 패널 타입으로 모든 아이템을 커버하는 조합
  for (const panel of panelSizes) {
    const { canFitAll, panelsNeeded, efficiency } = calculateYield(
      items,
      panel.width,
      panel.height,
      thickness
    );

    if (canFitAll && panelsNeeded > 0) {
      combinations.push({
        panels: [
          {
            size: panel.name,
            width: panel.width,
            height: panel.height,
            quantity: panelsNeeded
          }
        ],
        totalPanels: panelsNeeded,
        averageEfficiency: efficiency,
        surplus: 0
      });
    }

    if (combinations.length >= maxCombinations) break;
  }

  return combinations.sort((a, b) => b.averageEfficiency - a.averageEfficiency);
};

// Worker 메시지 핸들러
self.onmessage = async (e: MessageEvent<CalculationRequest>) => {
  const { items, panelSizes, thickness, quality } = e.data;

  try {
    const totalSteps = panelSizes.length + 1;
    let completedSteps = 0;

    const results: YieldResult[] = [];
    const totalRequired = items.reduce((sum, item) => sum + item.quantity, 0);

    // 각 패널 사이즈에 대해 수율 계산
    for (const panel of panelSizes) {
      const { canFitAll, efficiency, wasteArea, panelsNeeded, piecesPerPanel } = calculateYield(
        items,
        panel.width,
        panel.height,
        thickness
      );

      if (canFitAll && piecesPerPanel > 0) {
        const totalPieces = totalRequired;
        const surplus = piecesPerPanel * panelsNeeded - totalRequired;

        results.push({
          panelSize: panel.name,
          panelWidth: panel.width,
          panelHeight: panel.height,
          piecesPerPanel,
          panelsNeeded,
          totalPieces,
          efficiency,
          wasteArea,
          surplus: Math.max(0, surplus)
        });
      }

      // 진행률 업데이트
      completedSteps++;
      const progress = Math.round((completedSteps / totalSteps) * 100);
      self.postMessage({ type: 'progress', progress } as ProgressMessage);
    }

    // 결과 정렬
    const sortedResults = results.sort((a, b) => {
      if (a.surplus !== b.surplus) {
        return a.surplus - b.surplus;
      }
      if (Math.abs(a.efficiency - b.efficiency) > 1) {
        return b.efficiency - a.efficiency;
      }
      return a.panelsNeeded - b.panelsNeeded;
    });

    // 조합 계산
    const combinations = calculateSimpleCombinations(items, panelSizes, 10, thickness);

    // 최종 결과 전송
    completedSteps++;
    self.postMessage({ type: 'progress', progress: 100 } as ProgressMessage);
    
    self.postMessage({
      type: 'result',
      yieldResults: sortedResults,
      combinations
    } as ResultMessage);
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
