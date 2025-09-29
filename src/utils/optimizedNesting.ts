interface CutItem {
  width: number;
  height: number;
  quantity: number;
  id: string;
}

interface PanelSize {
  name: string;
  width: number;
  height: number;
}

interface PlacedItem {
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  itemId: string;
}

interface NestingResult {
  positions: PlacedItem[];
  totalPieces: number;
  canFitAll: boolean;
  placedCounts: { [key: string]: number };
  efficiency: number;
  wasteArea: number;
}

// 개선된 네스팅 알고리즘 - Bottom-Left Fill with optimization
export const optimizedNesting = (
  items: CutItem[],
  panelW: number,
  panelH: number,
  selectedThickness?: string
): NestingResult => {
  // 두께에 따른 간격 설정 - 다른 컴포넌트와 통일
  const thickness = parseFloat(selectedThickness?.replace('T', '') || '0');
  const SPACING = thickness < 10 ? 6 : 8;
  const MARGIN = 0; // 가용사이즈가 이미 재단 가능 영역이므로 마진 불필요
  
  const usableWidth = panelW - (MARGIN * 2);
  const usableHeight = panelH - (MARGIN * 2);
  
  // 모든 도형을 개별 피스로 확장하고 효율적으로 정렬
  const allPieces: Array<{ width: number; height: number; itemId: string; area: number }> = [];
  
  items.forEach(item => {
    for (let i = 0; i < item.quantity; i++) {
      allPieces.push({
        width: item.width,
        height: item.height,
        itemId: item.id,
        area: item.width * item.height
      });
    }
  });
  
  // 면적 기준으로 내림차순 정렬 (큰 것부터 배치)
  allPieces.sort((a, b) => b.area - a.area);
  
  const positions: PlacedItem[] = [];
  const placedCounts: { [key: string]: number } = {};
  
  // Bottom-Left Fill 알고리즘 구현
  for (const piece of allPieces) {
    let bestPosition: PlacedItem | null = null;
    let bestScore = Infinity;
    
    // 회전 가능한 경우들 시도
    const orientations = [
      { width: piece.width, height: piece.height, rotated: false },
      { width: piece.height, height: piece.width, rotated: true }
    ];
    
    for (const orientation of orientations) {
      // 원판 크기 체크
      if (orientation.width > usableWidth || orientation.height > usableHeight) continue;
      
      // 가능한 모든 위치에서 최적 위치 찾기
      for (let y = MARGIN; y <= MARGIN + usableHeight - orientation.height; y += 1) {
        for (let x = MARGIN; x <= MARGIN + usableWidth - orientation.width; x += 1) {
          
          // 겹침 체크
          if (isOverlapping(x, y, orientation.width, orientation.height, positions, SPACING)) {
            continue;
          }
          
          // 경계 체크
          if (x + orientation.width > MARGIN + usableWidth || 
              y + orientation.height > MARGIN + usableHeight) {
            continue;
          }
          
          // Bottom-Left Fill 점수 계산 (왼쪽 아래 우선)
          const score = calculatePlacementScore(x, y, orientation.width, orientation.height, positions);
          
          if (score < bestScore) {
            bestScore = score;
            bestPosition = {
              x, y,
              width: orientation.width,
              height: orientation.height,
              rotated: orientation.rotated,
              itemId: piece.itemId
            };
          }
        }
      }
    }
    
    // 최적 위치에 배치
    if (bestPosition) {
      positions.push(bestPosition);
      placedCounts[piece.itemId] = (placedCounts[piece.itemId] || 0) + 1;
    } else {
      // 더 이상 배치할 수 없으면 중단
      break;
    }
  }
  
  // 효율성 계산
  const totalPlacedArea = positions.reduce((sum, pos) => sum + (pos.width * pos.height), 0);
  const totalPanelArea = panelW * panelH;
  const efficiency = totalPanelArea > 0 ? (totalPlacedArea / totalPanelArea) * 100 : 0;
  const wasteArea = totalPanelArea - totalPlacedArea;
  
  return {
    positions,
    totalPieces: positions.length,
    canFitAll: positions.length === allPieces.length,
    placedCounts,
    efficiency,
    wasteArea
  };
};

// 겹침 체크 함수
const isOverlapping = (
  x: number, 
  y: number, 
  width: number, 
  height: number, 
  existingPositions: PlacedItem[],
  spacing: number
): boolean => {
  return existingPositions.some(pos => 
    !(x >= pos.x + pos.width + spacing || 
      x + width + spacing <= pos.x || 
      y >= pos.y + pos.height + spacing || 
      y + height + spacing <= pos.y)
  );
};

// 배치 점수 계산 (Bottom-Left Fill 최적화)
const calculatePlacementScore = (
  x: number, 
  y: number, 
  width: number, 
  height: number,
  existingPositions: PlacedItem[]
): number => {
  // 기본 점수: 왼쪽 아래 우선 (y가 클수록, x가 작을수록 좋음)
  let score = y * 1000 + x;
  
  // 기존 도형과의 접촉 보너스 (재료 효율성 향상)
  let contactBonus = 0;
  for (const pos of existingPositions) {
    // 옆면 접촉
    if (Math.abs(x - (pos.x + pos.width)) < 1 || Math.abs(x + width - pos.x) < 1) {
      if (!(y >= pos.y + pos.height || y + height <= pos.y)) {
        contactBonus += 100;
      }
    }
    // 윗면/아랫면 접촉
    if (Math.abs(y - (pos.y + pos.height)) < 1 || Math.abs(y + height - pos.y) < 1) {
      if (!(x >= pos.x + pos.width || x + width <= pos.x)) {
        contactBonus += 100;
      }
    }
  }
  
  return score - contactBonus;
};

// 멀티 패널 최적화 함수
export const optimizeMultiPanel = (
  items: CutItem[],
  availablePanels: PanelSize[],
  selectedThickness?: string,
  maxPanels: number = 5
): Array<{
  panelCombination: Array<{ panel: PanelSize; quantity: number }>;
  totalPanels: number;
  totalEfficiency: number;
  totalWaste: number;
  allItemsPlaced: boolean;
  results: Array<{ panelName: string; nestingResult: NestingResult }>;
}> => {
  const results: Array<{
    panelCombination: Array<{ panel: PanelSize; quantity: number }>;
    totalPanels: number;
    totalEfficiency: number;
    totalWaste: number;
    allItemsPlaced: boolean;
    results: Array<{ panelName: string; nestingResult: NestingResult }>;
  }> = [];
  
  // 단일 패널 최적화 시도
  for (const panel of availablePanels) {
    const singlePanelResult = trySinglePanelOptimization(items, panel, selectedThickness, maxPanels);
    if (singlePanelResult && singlePanelResult.allItemsPlaced) {
      results.push(singlePanelResult);
    }
  }
  
  // 다중 패널 조합 시도 (2개 패널)
  for (let i = 0; i < availablePanels.length; i++) {
    for (let j = i; j < availablePanels.length; j++) {
      const panel1 = availablePanels[i];
      const panel2 = availablePanels[j];
      const multiPanelResult = tryMultiPanelCombination(items, [panel1, panel2], selectedThickness);
      if (multiPanelResult && multiPanelResult.allItemsPlaced) {
        results.push(multiPanelResult);
      }
    }
  }
  
  // 결과 정렬: 원판 개수 최소화 우선, 그 다음 효율성
  results.sort((a, b) => {
    if (a.totalPanels !== b.totalPanels) {
      return a.totalPanels - b.totalPanels; // 적은 패널 수 우선
    }
    return b.totalEfficiency - a.totalEfficiency; // 높은 효율성 우선
  });
  
  return results.slice(0, 10); // 상위 10개만 반환
};

// 단일 패널 타입으로 모든 아이템 배치 시도
const trySinglePanelOptimization = (
  items: CutItem[],
  panel: PanelSize,
  selectedThickness?: string,
  maxPanels: number = 5
) => {
  let remainingItems = [...items];
  const panelResults: Array<{ panelName: string; nestingResult: NestingResult }> = [];
  let panelCount = 0;
  
  while (remainingItems.some(item => item.quantity > 0) && panelCount < maxPanels) {
    const itemsToPlace = remainingItems.filter(item => item.quantity > 0);
    if (itemsToPlace.length === 0) break;
    
    const nestingResult = optimizedNesting(itemsToPlace, panel.width, panel.height, selectedThickness);
    
    if (nestingResult.totalPieces === 0) break; // 더 이상 배치할 수 없음
    
    panelResults.push({
      panelName: panel.name,
      nestingResult
    });
    
    // 배치된 수량만큼 차감
    remainingItems = remainingItems.map(item => ({
      ...item,
      quantity: Math.max(0, item.quantity - (nestingResult.placedCounts[item.id] || 0))
    }));
    
    panelCount++;
  }
  
  const allItemsPlaced = remainingItems.every(item => item.quantity === 0);
  
  if (allItemsPlaced && panelResults.length > 0) {
    const totalEfficiency = panelResults.reduce((sum, result) => sum + result.nestingResult.efficiency, 0) / panelResults.length;
    const totalWaste = panelResults.reduce((sum, result) => sum + result.nestingResult.wasteArea, 0);
    
    return {
      panelCombination: [{ panel, quantity: panelResults.length }],
      totalPanels: panelResults.length,
      totalEfficiency,
      totalWaste,
      allItemsPlaced: true,
      results: panelResults
    };
  }
  
  return null;
};

// 다중 패널 타입 조합 시도
const tryMultiPanelCombination = (
  items: CutItem[],
  panels: PanelSize[],
  selectedThickness?: string
) => {
  let remainingItems = [...items];
  const panelResults: Array<{ panelName: string; nestingResult: NestingResult }> = [];
  
  for (const panel of panels) {
    const itemsToPlace = remainingItems.filter(item => item.quantity > 0);
    if (itemsToPlace.length === 0) break;
    
    const nestingResult = optimizedNesting(itemsToPlace, panel.width, panel.height, selectedThickness);
    
    if (nestingResult.totalPieces > 0) {
      panelResults.push({
        panelName: panel.name,
        nestingResult
      });
      
      // 배치된 수량만큼 차감
      remainingItems = remainingItems.map(item => ({
        ...item,
        quantity: Math.max(0, item.quantity - (nestingResult.placedCounts[item.id] || 0))
      }));
    }
  }
  
  const allItemsPlaced = remainingItems.every(item => item.quantity === 0);
  
  if (allItemsPlaced && panelResults.length > 0) {
    const totalEfficiency = panelResults.reduce((sum, result) => sum + result.nestingResult.efficiency, 0) / panelResults.length;
    const totalWaste = panelResults.reduce((sum, result) => sum + result.nestingResult.wasteArea, 0);
    const panelCombination = panels.map(panel => ({ panel, quantity: 1 }));
    
    return {
      panelCombination,
      totalPanels: panels.length,
      totalEfficiency,
      totalWaste,
      allItemsPlaced: true,
      results: panelResults
    };
  }
  
  return null;
};