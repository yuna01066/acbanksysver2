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

// 개선된 네스팅 알고리즘 - 공간 효율성 극대화
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
  
  // 모든 도형을 개별 피스로 확장
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
  
  // 면적과 높이를 고려한 정렬 (큰 것부터, 높이가 큰 것부터)
  allPieces.sort((a, b) => {
    if (Math.abs(a.area - b.area) > 100) {
      return b.area - a.area;
    }
    return b.height - a.height;
  });
  
  const positions: PlacedItem[] = [];
  const placedCounts: { [key: string]: number } = {};
  
  // 스카이라인 알고리즘 기반 배치
  const skyline: Array<{ x: number; y: number; width: number }> = [
    { x: MARGIN, y: MARGIN, width: usableWidth }
  ];
  
  for (const piece of allPieces) {
    let bestPosition: PlacedItem | null = null;
    let bestSkylineIndex = -1;
    let bestY = Infinity;
    
    // 회전 가능한 경우들 시도
    const orientations = [
      { width: piece.width, height: piece.height, rotated: false },
      { width: piece.height, height: piece.width, rotated: true }
    ];
    
    for (const orientation of orientations) {
      // 원판 크기 체크
      if (orientation.width > usableWidth || orientation.height > usableHeight) continue;
      
      // 각 스카이라인 세그먼트에서 배치 가능성 확인
      for (let i = 0; i < skyline.length; i++) {
        const segment = skyline[i];
        
        // 세그먼트에 맞는지 확인
        if (segment.width >= orientation.width + SPACING) {
          const x = segment.x;
          const y = segment.y;
          
          // 경계 체크
          if (x + orientation.width <= MARGIN + usableWidth && 
              y + orientation.height <= MARGIN + usableHeight) {
            
            // 높이가 가장 낮은 위치 우선 (더 밀집된 배치)
            if (y < bestY) {
              bestY = y;
              bestPosition = {
                x, y,
                width: orientation.width,
                height: orientation.height,
                rotated: orientation.rotated,
                itemId: piece.itemId
              };
              bestSkylineIndex = i;
            }
          }
        }
      }
    }
    
    // 최적 위치에 배치 및 스카이라인 업데이트
    if (bestPosition && bestSkylineIndex >= 0) {
      positions.push(bestPosition);
      placedCounts[piece.itemId] = (placedCounts[piece.itemId] || 0) + 1;
      
      // 스카이라인 업데이트
      updateSkyline(skyline, bestSkylineIndex, bestPosition, SPACING);
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

// 스카이라인 업데이트 함수
const updateSkyline = (
  skyline: Array<{ x: number; y: number; width: number }>,
  segmentIndex: number,
  placedItem: PlacedItem,
  spacing: number
): void => {
  const segment = skyline[segmentIndex];
  const itemRight = placedItem.x + placedItem.width + spacing;
  const itemTop = placedItem.y + placedItem.height + spacing;
  
  // 배치된 도형으로 인한 스카이라인 변경
  const newSegments: Array<{ x: number; y: number; width: number }> = [];
  
  // 배치된 도형의 왼쪽 부분
  if (placedItem.x > segment.x) {
    newSegments.push({
      x: segment.x,
      y: segment.y,
      width: placedItem.x - segment.x
    });
  }
  
  // 배치된 도형 위쪽 새로운 세그먼트
  newSegments.push({
    x: placedItem.x,
    y: itemTop,
    width: placedItem.width
  });
  
  // 배치된 도형의 오른쪽 부분
  const remainingWidth = segment.width - (itemRight - segment.x);
  if (remainingWidth > 0) {
    newSegments.push({
      x: itemRight,
      y: segment.y,
      width: remainingWidth
    });
  }
  
  // 스카이라인 업데이트
  skyline.splice(segmentIndex, 1, ...newSegments);
  
  // 인접한 세그먼트들 병합
  mergeSkylineSegments(skyline);
};

// 스카이라인 세그먼트 병합
const mergeSkylineSegments = (
  skyline: Array<{ x: number; y: number; width: number }>
): void => {
  let i = 0;
  while (i < skyline.length - 1) {
    const current = skyline[i];
    const next = skyline[i + 1];
    
    // 같은 높이의 인접한 세그먼트 병합
    if (Math.abs(current.y - next.y) < 1 && 
        Math.abs(current.x + current.width - next.x) < 1) {
      current.width += next.width;
      skyline.splice(i + 1, 1);
    } else {
      i++;
    }
  }
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