interface PanelSize {
  name: string;
  width: number;
  height: number;
}

interface CutItem {
  width: number;
  height: number;
  quantity: number;
  id: string;
}

interface PanelUsage {
  panelName: string;
  quantity: number;
  placedItems: Array<{ itemId: string; count: number }>;
  efficiency: number;
}

interface CombinationResult {
  panels: PanelUsage[];
  totalEfficiency: number;
  totalWasteArea: number;
  totalCost: number;
  allItemsPlaced: boolean;
  remainingItems: Array<{ itemId: string; remaining: number }>;
}

// 복합 네스팅 알고리즘
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
  const SPACING = 5; // 50mm의 1/10 = 5mm 간격
  
  const usableWidth = panelW - (MARGIN * 2);
  const usableHeight = panelH - (MARGIN * 2);
  
  // 모든 도형을 크기 순으로 정렬
  const allPieces: Array<{ width: number; height: number; itemId: string }> = [];
  items.forEach(item => {
    for (let i = 0; i < item.quantity; i++) {
      allPieces.push({
        width: item.width,
        height: item.height,
        itemId: item.id
      });
    }
  });
  
  allPieces.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  
  const positions: Array<{ x: number; y: number; width: number; height: number; rotated: boolean; itemId: string }> = [];
  const occupiedAreas: Array<{ x: number; y: number; width: number; height: number }> = [];
  const placedCounts: { [key: string]: number } = {};
  
  // 위치가 겹치는지 확인 (5mm 간격 포함)
  const isOverlapping = (x: number, y: number, w: number, h: number): boolean => {
    return occupiedAreas.some(area => 
      !(x >= area.x + area.width + SPACING || x + w + SPACING <= area.x || 
        y >= area.y + area.height + SPACING || y + h + SPACING <= area.y)
    );
  };
  
  // 각 도형 배치 시도
  for (const piece of allPieces) {
    let placed = false;
    
    const orientations = [
      { width: piece.width, height: piece.height, rotated: false },
      { width: piece.height, height: piece.width, rotated: true }
    ];
    
    for (const orientation of orientations) {
      if (placed) break;
      
      if (orientation.width > usableWidth || orientation.height > usableHeight) continue;
      
      for (let y = MARGIN; y <= MARGIN + usableHeight - orientation.height && !placed; y += 5) {
        for (let x = MARGIN; x <= MARGIN + usableWidth - orientation.width && !placed; x += 5) {
          if (!isOverlapping(x, y, orientation.width, orientation.height)) {
            positions.push({
              x, y,
              width: orientation.width,
              height: orientation.height,
              rotated: orientation.rotated,
              itemId: piece.itemId
            });
            
            occupiedAreas.push({ x, y, width: orientation.width, height: orientation.height });
            placedCounts[piece.itemId] = (placedCounts[piece.itemId] || 0) + 1;
            placed = true;
          }
        }
      }
    }
    
    if (!placed) break;
  }
  
  return {
    positions,
    totalPieces: positions.length,
    canFitAll: positions.length === allPieces.length,
    placedCounts
  };
};

// 단일 원판에서 최대한 많은 아이템 배치
const optimizeForSinglePanel = (
  items: CutItem[],
  panel: PanelSize
): { placedCounts: { [key: string]: number }; efficiency: number; wasteArea: number } => {
  const result = calculateMultiItemLayout(items, panel.width, panel.height);
  
  const totalRequiredArea = Object.keys(result.placedCounts).reduce((sum, itemId) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return sum;
    return sum + (item.width * item.height * result.placedCounts[itemId]);
  }, 0);
  
  const totalArea = panel.width * panel.height;
  const efficiency = totalArea > 0 ? (totalRequiredArea / totalArea) * 100 : 0;
  const wasteArea = totalArea - totalRequiredArea;
  
  return {
    placedCounts: result.placedCounts,
    efficiency,
    wasteArea
  };
};

// 복합 조합 계산
export const calculatePanelCombinations = (
  cutItems: CutItem[],
  availablePanels: PanelSize[],
  maxCombinations: number = 10
): CombinationResult[] => {
  const results: CombinationResult[] = [];
  
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
      sum + usage.placedItems.reduce((itemSum, placed) => itemSum + placed.count, 0), 0
    );
    
    if (totalPlaced > 0) {
      const avgEfficiency = panelUsages.reduce((sum, usage) => sum + usage.efficiency, 0) / panelUsages.length;
      const totalWaste = panelUsages.length * panel.width * panel.height - 
        cutItems.reduce((sum, item) => sum + (item.width * item.height * Math.min(item.quantity, totalPlaced)), 0);
      
      results.push({
        panels: panelUsages,
        totalEfficiency: avgEfficiency,
        totalWasteArea: totalWaste,
        totalCost: panelUsages.length, // 임시로 판 개수를 비용으로 사용
        allItemsPlaced: totalPlaced >= totalRequired,
        remainingItems: remainingItems.filter(item => item.quantity > 0).map(item => ({
          itemId: item.id,
          remaining: item.quantity
        }))
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
        const totalRequired = cutItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalPlaced = panelUsages.reduce((sum, usage) => 
          sum + usage.placedItems.reduce((itemSum, placed) => itemSum + placed.count, 0), 0
        );
        
        const avgEfficiency = panelUsages.reduce((sum, usage) => sum + usage.efficiency, 0) / panelUsages.length;
        const totalWaste = (panel1.width * panel1.height + panel2.width * panel2.height) - 
          cutItems.reduce((sum, item) => sum + (item.width * item.height * Math.min(item.quantity, totalPlaced)), 0);
        
        results.push({
          panels: panelUsages,
          totalEfficiency: avgEfficiency,
          totalWasteArea: totalWaste,
          totalCost: panelUsages.length,
          allItemsPlaced: totalPlaced >= totalRequired,
          remainingItems: remainingItems.filter(item => item.quantity > 0).map(item => ({
            itemId: item.id,
            remaining: item.quantity
          }))
        });
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