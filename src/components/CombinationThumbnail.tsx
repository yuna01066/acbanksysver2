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
}

interface CombinationThumbnailProps {
  panelUsages: PanelUsage[];
  cutItems: CutItem[];
  availablePanelSizes: Array<{ name: string; width: number; height: number }>;
}

const CombinationThumbnail: React.FC<CombinationThumbnailProps> = ({
  panelUsages,
  cutItems,
  availablePanelSizes
}) => {
  const [currentPanelIndex, setCurrentPanelIndex] = useState(0);
  
  const MARGIN = 80;
  const SPACING = 50; // 정확히 50mm 간격 (변경 금지)
  const THUMBNAIL_WIDTH = 240;
  const THUMBNAIL_HEIGHT = 180;

  // 현재 선택된 원판 정보
  const currentPanelUsage = panelUsages[currentPanelIndex];
  const currentPanelInfo = availablePanelSizes.find(p => p.name === currentPanelUsage?.panelName);
  
  if (!currentPanelUsage || !currentPanelInfo) {
    return <div className="w-[240px] h-[180px] bg-muted rounded border flex items-center justify-center text-sm text-muted-foreground">
      네스팅 정보 없음
    </div>;
  }

  // 1/10 스케일 계산 (원판 mm 기준으로 정확히 1/10)
  const scale = 0.1;
  const scaledPanelWidth = currentPanelInfo.width * scale;
  const scaledPanelHeight = currentPanelInfo.height * scale;
  
  // 썸네일 크기를 원판 크기에 맞게 조정 (최소 240x180 보장)
  const thumbnailWidth = Math.max(THUMBNAIL_WIDTH, scaledPanelWidth + 40);
  const thumbnailHeight = Math.max(THUMBNAIL_HEIGHT, scaledPanelHeight + 40);
  
  const offsetX = (thumbnailWidth - scaledPanelWidth) / 2;
  const offsetY = (thumbnailHeight - scaledPanelHeight) / 2;

  // 배치된 도형들 계산
  const calculateLayout = () => {
    const usableWidth = currentPanelInfo.width - (MARGIN * 2);
    const usableHeight = currentPanelInfo.height - (MARGIN * 2);
    
    const positions: Array<{ x: number; y: number; width: number; height: number; rotated: boolean; color: string; itemIndex: number }> = [];
    const occupiedAreas: Array<{ x: number; y: number; width: number; height: number }> = [];
    
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
      '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
    ];

    const GAP = SPACING; // 정확히 50mm 간격

    // 겹침 확인 함수 (간격 포함)
    const isOverlapping = (x: number, y: number, w: number, h: number): boolean => {
      return occupiedAreas.some(area => 
        !(x >= area.x + area.width + GAP || 
          x + w + GAP <= area.x || 
          y >= area.y + area.height + GAP || 
          y + h + GAP <= area.y)
      );
    };

    // 특정 위치에 배치 가능한지 확인 (엄격한 경계 검사)
    const canPlaceAt = (x: number, y: number, w: number, h: number): boolean => {
      // 원판 경계 내부에 완전히 있는지 엄격하게 확인
      if (x < MARGIN || y < MARGIN || 
          x + w > MARGIN + usableWidth || 
          y + h > MARGIN + usableHeight) {
        return false;
      }
      // 다른 도형과 50mm 간격을 유지하는지 확인
      return !isOverlapping(x, y, w, h);
    };

    // 배치할 아이템들 생성
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

    console.log('CombinationThumbnail - 배치할 아이템들:', itemsToPlace);
    console.log('CombinationThumbnail - 총 배치해야 할 개수:', itemsToPlace.reduce((sum, item) => sum + item.count, 0));

    // 면적 기준으로 내림차순 정렬 (큰 것부터 배치)
    itemsToPlace.sort((a, b) => (b.width * b.height) - (a.width * a.height));

    // 각 아이템 타입별로 배치
    for (const item of itemsToPlace) {
      for (let i = 0; i < item.count; i++) {
        let placed = false;
        
        // 가능한 모든 위치를 체크하여 배치 (5mm 간격으로 더 세밀하게)
        for (let y = MARGIN; y <= MARGIN + usableHeight - item.height && !placed; y += 5) {
          for (let x = MARGIN; x <= MARGIN + usableWidth - item.width && !placed; x += 5) {
            if (canPlaceAt(x, y, item.width, item.height)) {
              positions.push({
                x,
                y,
                width: item.width,
                height: item.height,
                rotated: false,
                color: colors[item.itemIndex % colors.length],
                itemIndex: item.itemIndex
              });
              
              occupiedAreas.push({
                x,
                y,
                width: item.width,
                height: item.height
              });
              
              placed = true;
            }
          }
        }
        
        // 원래 방향으로 배치할 수 없으면 회전해서 시도 (5mm 간격)
        if (!placed && item.width !== item.height) {
          for (let y = MARGIN; y <= MARGIN + usableHeight - item.width && !placed; y += 5) {
            for (let x = MARGIN; x <= MARGIN + usableWidth - item.height && !placed; x += 5) {
              if (canPlaceAt(x, y, item.height, item.width)) {
                positions.push({
                  x,
                  y,
                  width: item.height,
                  height: item.width,
                  rotated: true,
                  color: colors[item.itemIndex % colors.length],
                  itemIndex: item.itemIndex
                });
                
                occupiedAreas.push({
                  x,
                  y,
                  width: item.height,
                  height: item.width
                });
                
                placed = true;
              }
            }
          }
        }
      }
    }

    console.log('CombinationThumbnail - 실제 배치된 개수:', positions.length);
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
         style={{ width: thumbnailWidth, height: thumbnailHeight }}>
      <svg
        width={thumbnailWidth}
        height={thumbnailHeight}
        className="absolute inset-0"
      >
        {/* 원판 배경 */}
        <rect
          x={offsetX}
          y={offsetY}
          width={scaledPanelWidth}
          height={scaledPanelHeight}
          fill="hsl(var(--muted))"
          stroke="hsl(var(--border))"
          strokeWidth="1"
          rx="4"
        />
        
        {/* 마진 영역 표시 */}
        <rect
          x={offsetX + (MARGIN * scale)}
          y={offsetY + (MARGIN * scale)}
          width={scaledPanelWidth - (MARGIN * 2 * scale)}
          height={scaledPanelHeight - (MARGIN * 2 * scale)}
          fill="none"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth="1"
          strokeDasharray="2,2"
          opacity="0.5"
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
            strokeWidth="1"
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