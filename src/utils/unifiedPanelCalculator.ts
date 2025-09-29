export interface CutItem {
  id: string;
  width: number;
  height: number;
  quantity: number;
}

export interface PanelSize {
  name: string;
  width: number;
  height: number;
}

export interface PanelUsage {
  panelName: string;
  quantity: number;
  placedItems: Array<{ itemId: string; count: number }>;
  efficiency: number;
}

export interface UnifiedResult {
  type: 'single' | 'combination';
  panels: PanelUsage[];
  totalEfficiency: number;
  totalWasteArea: number;
  totalCost: number;
  allItemsPlaced: boolean;
  remainingItems: Array<{ itemId: string; remaining: number }>;
  panelsNeeded: number;
  
  // 단일 원판 전용 필드들
  panelSize?: string;
  panelWidth?: number;
  panelHeight?: number;
  piecesPerPanel?: number;
  surplus?: number;
}

// 네스팅 알고리즘 - 여러 도형을 함께 배치
const calculateMultiItemLayout = (
  items: CutItem[],
  panelW: number,
  panelH: number
): { 
  positions: Array<{ x: number; y: number; width: number; height: number; rotated: boolean; itemId: string }>;
  totalPieces: number;
  canFitAll: boolean;
  placedCounts: { [key: string]: number };
} => {
  const MARGIN = 80;
  const SPACING = 10; // 10mm 간격
  
  const usableWidth = panelW - (MARGIN * 2);
  const usableHeight = panelH - (MARGIN * 2);
  
  // 배치 결과를 저장할 배열들 초기화
  const positions: Array<{ x: number; y: number; width: number; height: number; rotated: boolean; itemId: string }> = [];
  const occupiedAreas: Array<{ x: number; y: number; width: number; height: number }> = [];
  const placedCounts: { [key: string]: number } = {};
  
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
  
  // 위치가 겹치는지 확인하는 함수 (10mm 간격 포함)
  const isOverlapping = (x: number, y: number, w: number, h: number): boolean => {
    const minGap = SPACING; // 10mm 간격
    return occupiedAreas.some(area => 
      !(x >= area.x + area.width + minGap || x + w + minGap <= area.x || 
        y >= area.y + area.height + minGap || y + h + minGap <= area.y)
    );
  };
  
  // 배치 점수 계산 함수
  function calculatePositionScore(x: number, y: number, orientation: { width: number; height: number; rotated: boolean }, maxWidth: number, maxHeight: number): number {
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
  
  // 각 도형 배치 시도 - 회전을 고려한 최적 배치
  for (const piece of allPieces) {
    let bestPosition = null;
    let bestScore = -1;
    
    // 가능한 배치 위치와 회전 시도 (더 체계적인 평가)
    const orientations = [
      { width: piece.width, height: piece.height, rotated: false },
      { width: piece.height, height: piece.width, rotated: true }
    ];
    
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
                x, y,
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
    } else {
      // 배치하지 못한 도형이 있으면 중단
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

// 단일 원판에 대한 최적화 함수
const optimizeForSinglePanel = (
  items: CutItem[],
  panel: PanelSize
): {
  placedCounts: { [key: string]: number };
  efficiency: number;
  wasteArea: number;
} => {
  const { placedCounts, totalPieces } = calculateMultiItemLayout(items, panel.width, panel.height);
  
  const totalRequiredArea = items.reduce((sum, item) => {
    const placedCount = placedCounts[item.id] || 0;
    return sum + (item.width * item.height * placedCount);
  }, 0);
  
  const panelArea = panel.width * panel.height;
  const efficiency = panelArea > 0 ? (totalRequiredArea / panelArea) * 100 : 0;
  const wasteArea = panelArea - totalRequiredArea;
  
  return {
    placedCounts,
    efficiency,
    wasteArea
  };
};

// 단일 원판 수율 계산
const calculateSinglePanelYield = (
  items: CutItem[],
  panelW: number, 
  panelH: number,
  panelName: string
): UnifiedResult | null => {
  let remainingItems = [...items];
  let totalPanelsNeeded = 0;
  let allPlacedCounts: { [key: string]: number } = {};
  let allCanFit = true;
  
  // 각 도형이 원판에 물리적으로 들어갈 수 있는지 먼저 확인
  for (const item of items) {
    const usableWidth = panelW - 160; // 마진 80*2
    const usableHeight = panelH - 160; // 마진 80*2
    
    // 회전 포함해서 들어갈 수 있는지 확인
    const canFitNormally = item.width <= usableWidth && item.height <= usableHeight;
    const canFitRotated = item.height <= usableWidth && item.width <= usableHeight;
    
    if (!canFitNormally && !canFitRotated) {
      allCanFit = false;
      break;
    }
  }
  
  if (!allCanFit) {
    return null;
  }
  
  // 여러 판에 걸쳐 배치 시뮬레이션
  while (remainingItems.some(item => item.quantity > 0)) {
    const itemsToPlace = remainingItems.filter(item => item.quantity > 0);
    if (itemsToPlace.length === 0) break;
    
    const { totalPieces, placedCounts } = calculateMultiItemLayout(itemsToPlace, panelW, panelH);
    
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
  const totalRequiredArea = items.reduce((sum, item) => sum + (item.width * item.height * item.quantity), 0);
  const totalPanelArea = panelW * panelH * totalPanelsNeeded;
  const efficiency = totalPanelArea > 0 ? (totalRequiredArea / totalPanelArea) * 100 : 0;
  const wasteArea = totalPanelArea - totalRequiredArea;
  const avgPiecesPerPanel = totalPanelsNeeded > 0 ? Math.round(totalPlaced / totalPanelsNeeded) : 0;
  const surplus = Math.max(0, totalPlaced - totalRequired);
  
  if (totalPlaced < totalRequired) {
    return null; // 모든 도형이 배치되지 않음
  }

  return {
    type: 'single',
    panels: [{
      panelName: panelName,
      quantity: totalPanelsNeeded,
      placedItems: Object.entries(allPlacedCounts).map(([itemId, count]) => ({ itemId, count })),
      efficiency
    }],
    totalEfficiency: efficiency,
    totalWasteArea: wasteArea,
    totalCost: totalPanelsNeeded,
    allItemsPlaced: true,
    remainingItems: [],
    panelsNeeded: totalPanelsNeeded,
    
    // 단일 원판 전용 필드들
    panelSize: panelName,
    panelWidth: panelW,
    panelHeight: panelH,
    piecesPerPanel: avgPiecesPerPanel,
    surplus
  };
};

// 복합 원판 조합 계산
const calculateCombinationResults = (
  cutItems: CutItem[],
  availablePanels: PanelSize[],
  maxCombinations: number = 10
): UnifiedResult[] => {
  const results: UnifiedResult[] = [];
  
  // 단일 원판 결과들 먼저 계산
  for (const panel of availablePanels) {
    let remainingItems = [...cutItems];
    const panelUsages: PanelUsage[] = [];
    let allPlaced = false;
    let iterations = 0;
    
    while (!allPlaced && iterations < 10) {
      const itemsToPlace = remainingItems.filter(item => item.quantity > 0);
      if (itemsToPlace.length === 0) {
        allPlaced = true;
        break;
      }
      
      const result = optimizeForSinglePanel(itemsToPlace, panel);
      
      if (Object.keys(result.placedCounts).length === 0) break;
      
      panelUsages.push({
        panelName: panel.name,
        quantity: 1,
        placedItems: Object.entries(result.placedCounts).map(([itemId, count]) => ({ itemId, count })),
        efficiency: result.efficiency
      });
      
      // 배치된 수량만큼 차감
      remainingItems = remainingItems.map(item => ({
        ...item,
        quantity: Math.max(0, item.quantity - (result.placedCounts[item.id] || 0))
      }));
      
      iterations++;
    }
    
    const totalRequired = cutItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalPlaced = panelUsages.reduce((sum, usage) => 
      sum + usage.placedItems.reduce((itemSum, placed) => itemSum + placed.count, 0) * usage.quantity, 0
    );
    
    // 모든 아이템이 배치되었는지 정확히 확인
    const allItemsPlaced = remainingItems.every(item => item.quantity === 0);
    
    if (totalPlaced > 0 && allItemsPlaced) {
      const avgEfficiency = panelUsages.reduce((sum, usage) => sum + usage.efficiency, 0) / panelUsages.length;
      const totalWaste = panelUsages.length * panel.width * panel.height - 
        cutItems.reduce((sum, item) => sum + (item.width * item.height * item.quantity), 0);
      
      results.push({
        type: 'combination',
        panels: panelUsages,
        totalEfficiency: avgEfficiency,
        totalWasteArea: totalWaste,
        totalCost: panelUsages.length,
        allItemsPlaced: true,
        remainingItems: [],
        panelsNeeded: panelUsages.length
      });
    }
  }
  
  // 2개 원판 조합 계산 (간단한 버전)
  for (let i = 0; i < availablePanels.length; i++) {
    for (let j = i; j < availablePanels.length; j++) {
      const panel1 = availablePanels[i];
      const panel2 = availablePanels[j];
      
      let remainingItems = [...cutItems];
      const panelUsages: PanelUsage[] = [];
      
      // 첫 번째 원판에 배치
      const result1 = optimizeForSinglePanel(remainingItems, panel1);
      if (Object.keys(result1.placedCounts).length > 0) {
        panelUsages.push({
          panelName: panel1.name,
          quantity: 1,
          placedItems: Object.entries(result1.placedCounts).map(([itemId, count]) => ({ itemId, count })),
          efficiency: result1.efficiency
        });
        
        remainingItems = remainingItems.map(item => ({
          ...item,
          quantity: Math.max(0, item.quantity - (result1.placedCounts[item.id] || 0))
        }));
      }
      
      // 두 번째 원판에 배치
      const itemsToPlace2 = remainingItems.filter(item => item.quantity > 0);
      if (itemsToPlace2.length > 0) {
        const result2 = optimizeForSinglePanel(itemsToPlace2, panel2);
        if (Object.keys(result2.placedCounts).length > 0) {
          panelUsages.push({
            panelName: panel2.name,
            quantity: 1,
            placedItems: Object.entries(result2.placedCounts).map(([itemId, count]) => ({ itemId, count })),
            efficiency: result2.efficiency
          });
          
          remainingItems = remainingItems.map(item => ({
            ...item,
            quantity: Math.max(0, item.quantity - (result2.placedCounts[item.id] || 0))
          }));
        }
      }
      
      if (panelUsages.length > 1) {
        // 모든 아이템이 배치되었는지 정확히 확인
        const allItemsPlaced = remainingItems.every(item => item.quantity === 0);
        
        if (allItemsPlaced) {
          const avgEfficiency = panelUsages.reduce((sum, usage) => sum + usage.efficiency, 0) / panelUsages.length;
          const totalWaste = (panel1.width * panel1.height + panel2.width * panel2.height) - 
            cutItems.reduce((sum, item) => sum + (item.width * item.height * item.quantity), 0);
          
          results.push({
            type: 'combination',
            panels: panelUsages,
            totalEfficiency: avgEfficiency,
            totalWasteArea: totalWaste,
            totalCost: panelUsages.length,
            allItemsPlaced: true,
            remainingItems: [],
            panelsNeeded: panelUsages.length
          });
        }
      }
    }
  }
  
  // 결과 정렬 (모든 아이템 배치 가능 > 효율성 > 적은 판 수)
  results.sort((a, b) => {
    if (a.allItemsPlaced !== b.allItemsPlaced) {
      return a.allItemsPlaced ? -1 : 1;
    }
    if (Math.abs(a.totalEfficiency - b.totalEfficiency) > 1) {
      return b.totalEfficiency - a.totalEfficiency;
    }
    return a.totalCost - b.totalCost;
  });
  
  return results.slice(0, maxCombinations);
};

// 통합 계산 함수
export const calculateUnifiedRecommendations = (
  cutItems: Array<{ id: string; width: string; height: string; quantity: string }>,
  availablePanelSizes: Array<{ name: string; width: number; height: number }>,
  maxResults: number = 10
): UnifiedResult[] => {
  // 유효한 재단 항목만 필터링
  const validCutItems = cutItems.filter(item => 
    item.width && item.height && item.quantity &&
    parseFloat(item.width) > 0 && parseFloat(item.height) > 0 && parseInt(item.quantity) > 0
  );

  if (validCutItems.length === 0) return [];

  // CutItem 형식으로 변환
  const itemsForCalculation: CutItem[] = validCutItems.map((item, index) => ({
    id: `item-${index}`,
    width: parseFloat(item.width),
    height: parseFloat(item.height),
    quantity: parseInt(item.quantity)
  }));

  const allResults: UnifiedResult[] = [];

  // 단일 원판 결과들 계산
  for (const panel of availablePanelSizes) {
    const singleResult = calculateSinglePanelYield(
      itemsForCalculation, 
      panel.width, 
      panel.height, 
      panel.name
    );
    if (singleResult) {
      allResults.push(singleResult);
    }
  }

  // 복합 조합 결과들 계산
  const combinationResults = calculateCombinationResults(itemsForCalculation, availablePanelSizes);
  allResults.push(...combinationResults);

  // 중복 제거 및 정렬
  const unifiedRecommendations = allResults
    .sort((a, b) => b.totalEfficiency - a.totalEfficiency) // 효율성 내림차순 정렬
    .filter((recommendation, index, array) => {
      // 첫 번째는 항상 포함
      if (index === 0) return true;
      
      // 이전 추천안들과 비교하여 중복 체크
      const isDuplicate = array.slice(0, index).some(prev => {
        // 효율성이 비슷한지 체크 (±0.5% 범위)
        const efficiencyDiff = Math.abs(prev.totalEfficiency - recommendation.totalEfficiency);
        const similarEfficiency = efficiencyDiff <= 0.5;
        
        // 패널 수가 같은지 체크
        const samePanelCount = prev.panelsNeeded === recommendation.panelsNeeded;
        
        // 효율성과 패널 수가 비슷하면 중복으로 간주
        if (similarEfficiency && samePanelCount) {
          // 단일 조합을 우선시 (더 간단하므로)
          return recommendation.type === 'combination' && prev.type === 'single';
        }
        
        return false;
      });
      
      return !isDuplicate;
    });

  return unifiedRecommendations.slice(0, maxResults);
};