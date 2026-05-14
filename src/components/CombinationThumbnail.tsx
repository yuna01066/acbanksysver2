import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CutItem {
  id: string;
  width: string;
  height: string;
  quantity: string;
}

interface PanelUsage {
  panelName: string;
  quantity: number;
  placedItems: Array<{ itemId: string; count: number }>;
  efficiency: number;
  positions?: Array<{ x: number; y: number; width: number; height: number; rotated: boolean; itemId: string }>;
}

interface CombinationThumbnailProps {
  panelUsages: PanelUsage[];
  cutItems: CutItem[];
  availablePanelSizes: Array<{ name: string; width: number; height: number }>;
  selectedThickness?: string;
}

const CombinationThumbnail: React.FC<CombinationThumbnailProps> = ({
  panelUsages,
  cutItems,
  availablePanelSizes,
  selectedThickness
}) => {
  const [currentPanelIndex, setCurrentPanelIndex] = useState(0);
  
  // 두께에 따른 간격 설정
  const thickness = parseFloat(selectedThickness?.replace('T', '') || '0');
  const SPACING = thickness < 10 ? 6 : 8; // 10T 미만: 6mm, 10T 이상: 8mm
  const THUMBNAIL_WIDTH = 400; // 썸네일 크기
  const THUMBNAIL_HEIGHT = 300;

  // 현재 선택된 원판 정보
  const currentPanelUsage = panelUsages[currentPanelIndex];
  const currentPanelInfo = availablePanelSizes.find(p => p.name === currentPanelUsage?.panelName);
  
  if (!currentPanelUsage || !currentPanelInfo) {
    return <div className="w-[400px] h-[300px] bg-muted rounded border flex items-center justify-center text-sm text-muted-foreground">
      네스팅 정보 없음
    </div>;
  }

  // 1/10 스케일 계산 (원판 mm 기준으로 정확히 1/10, 절대 변경 금지)
  const scale = 0.1;
  const scaledPanelWidth = currentPanelInfo.width * scale;
  const scaledPanelHeight = currentPanelInfo.height * scale;
  
  // 썸네일 크기는 고정 (240x180)
  const offsetX = (THUMBNAIL_WIDTH - scaledPanelWidth) / 2;
  const offsetY = (THUMBNAIL_HEIGHT - scaledPanelHeight) / 2;

  const calculateLayout = () => {
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
      '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
    ];

    if (currentPanelUsage.positions && currentPanelUsage.positions.length > 0) {
      return currentPanelUsage.positions.map(pos => {
        const itemIndex = parseInt(pos.itemId.replace('item-', ''));
        return {
          ...pos,
          color: colors[itemIndex % colors.length],
          itemIndex,
        };
      });
    }

    const itemsToPlace: Array<{ width: number; height: number; itemIndex: number; count: number }> = [];
    
    currentPanelUsage.placedItems.forEach(placedItem => {
      const itemIndex = parseInt(placedItem.itemId.replace('item-', ''));
      const cutItem = cutItems[itemIndex];
      
      if (cutItem) {
        const cutW = parseFloat(cutItem.width);
        const cutH = parseFloat(cutItem.height);
        
        itemsToPlace.push({
          width: cutW,
          height: cutH,
          itemIndex,
          count: placedItem.count
        });
      }
    });

    itemsToPlace.sort((a, b) => (b.width * b.height) - (a.width * a.height));

    const positions: Array<{ x: number; y: number; width: number; height: number; rotated: boolean; color: string; itemIndex: number }> = [];
    const rowHeights: number[] = [];
    let x = 0;
    let y = 0;
    let row = 0;

    for (const item of itemsToPlace) {
      for (let i = 0; i < item.count; i++) {
        if (x + item.width > currentPanelInfo.width) {
          x = 0;
          y += (rowHeights[row] || 0) + SPACING;
          row += 1;
        }
        if (y + item.height > currentPanelInfo.height) {
          return positions;
        }
        positions.push({
          x,
          y,
          width: item.width,
          height: item.height,
          rotated: false,
          color: colors[item.itemIndex % colors.length],
          itemIndex: item.itemIndex
        });
        rowHeights[row] = Math.max(rowHeights[row] || 0, item.height);
        x += item.width + SPACING;
      }
    }

    return positions;
  };

  const layout = calculateLayout();

  const handlePrevPanel = () => {
    setCurrentPanelIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextPanel = () => {
    setCurrentPanelIndex(prev => Math.min(panelUsages.length - 1, prev + 1));
  };

  return (
    <div className="relative bg-background border border-border rounded-lg overflow-hidden" 
         style={{ width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT }}>
      <svg
        width={THUMBNAIL_WIDTH}
        height={THUMBNAIL_HEIGHT}
        className="absolute inset-0"
      >
        {/* 가용사이즈 영역 */}
        <rect
          x={offsetX}
          y={offsetY}
          width={scaledPanelWidth}
          height={scaledPanelHeight}
          fill="hsl(var(--muted))"
          stroke="hsl(var(--foreground))"
          strokeWidth="0.5"
          rx="4"
        />
        
        {/* 배치된 도형들 */}
        {layout.map((pos, index) => (
          <rect
            key={index}
            x={offsetX + (pos.x * scale)}
            y={offsetY + (pos.y * scale)}
            width={pos.width * scale}
            height={pos.height * scale}
            fill={pos.color}
            fillOpacity="0.7"
            stroke={pos.color}
            strokeWidth="0.5"
            rx="2"
          />
        ))}
      </svg>
      
      {/* 원판 네비게이션 */}
      {panelUsages.length > 1 && (
        <>
          {/* 이전 버튼 */}
          {currentPanelIndex > 0 && (
            <button
              onClick={handlePrevPanel}
              className="absolute left-1 top-1/2 -translate-y-1/2 w-5 h-5 bg-background/80 hover:bg-background border border-border rounded-full flex items-center justify-center transition-colors"
              aria-label="이전 원판"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
          )}
          
          {/* 다음 버튼 */}
          {currentPanelIndex < panelUsages.length - 1 && (
            <button
              onClick={handleNextPanel}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 bg-background/80 hover:bg-background border border-border rounded-full flex items-center justify-center transition-colors"
              aria-label="다음 원판"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
          
          {/* 원판 인디케이터 */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-background/80 text-xs px-1.5 py-0.5 rounded border border-border">
            {currentPanelIndex + 1} / {panelUsages.length}
          </div>
        </>
      )}
      
      {/* 원판 정보 */}
      <div className="absolute top-1 right-1 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded">
        {currentPanelUsage.panelName}
      </div>
    </div>
  );
};

export default CombinationThumbnail;
