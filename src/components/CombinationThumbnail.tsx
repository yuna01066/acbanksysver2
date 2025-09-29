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
  const SPACING = 50;
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

  // 스케일 계산
  const scaleX = THUMBNAIL_WIDTH / currentPanelInfo.width;
  const scaleY = THUMBNAIL_HEIGHT / currentPanelInfo.height;
  const scale = Math.min(scaleX, scaleY) * 0.85;
  
  const scaledPanelWidth = currentPanelInfo.width * scale;
  const scaledPanelHeight = currentPanelInfo.height * scale;
  
  const offsetX = (THUMBNAIL_WIDTH - scaledPanelWidth) / 2;
  const offsetY = (THUMBNAIL_HEIGHT - scaledPanelHeight) / 2;

  // 배치된 도형들 계산
  const calculateLayout = () => {
    const usableWidth = currentPanelInfo.width - (MARGIN * 2);
    const usableHeight = currentPanelInfo.height - (MARGIN * 2);
    
    const positions: Array<{ x: number; y: number; width: number; height: number; rotated: boolean; color: string; itemIndex: number }> = [];
    
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
      '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
    ];

    // 실제 배치된 아이템들을 기반으로 시각화 (더 정확한 표현)
    let currentX = MARGIN;
    let currentY = MARGIN;
    let rowHeight = 0;
    const GAP = 15; // 아이템 간 간격

    currentPanelUsage.placedItems.forEach(placedItem => {
      const itemIndex = parseInt(placedItem.itemId.replace('item-', ''));
      const cutItem = cutItems[itemIndex];
      
      if (cutItem) {
        const cutW = parseFloat(cutItem.width);
        const cutH = parseFloat(cutItem.height);
        
        for (let i = 0; i < placedItem.count; i++) {
          // 현재 행에 공간이 충분한지 확인
          if (currentX + cutW > MARGIN + usableWidth) {
            // 다음 행으로 이동
            currentX = MARGIN;
            currentY += rowHeight + GAP;
            rowHeight = 0;
            
            // 세로 공간 초과 시 배치 중단
            if (currentY + cutH > MARGIN + usableHeight) {
              break;
            }
          }
          
          // 현재 위치에 배치
          positions.push({
            x: currentX,
            y: currentY,
            width: cutW,
            height: cutH,
            rotated: false,
            color: colors[itemIndex % colors.length],
            itemIndex
          });
          
          // 다음 위치 계산
          currentX += cutW + GAP;
          rowHeight = Math.max(rowHeight, cutH);
        }
      }
    });

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