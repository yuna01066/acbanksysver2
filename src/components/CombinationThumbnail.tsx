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
    const occupiedAreas: Array<{ x: number; y: number; width: number; height: number }> = [];
    
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
      '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
    ];

    // 배치할 도형들 생성
    const piecesToPlace: Array<{ width: number; height: number; itemIndex: number; pieceId: string }> = [];
    
    currentPanelUsage.placedItems.forEach(placedItem => {
      const itemIndex = parseInt(placedItem.itemId.replace('item-', ''));
      const cutItem = cutItems[itemIndex];
      
      if (cutItem) {
        const cutW = parseFloat(cutItem.width);
        const cutH = parseFloat(cutItem.height);
        
        for (let i = 0; i < placedItem.count; i++) {
          piecesToPlace.push({
            width: cutW,
            height: cutH,
            itemIndex,
            pieceId: `${placedItem.itemId}-piece-${i}`
          });
        }
      }
    });

    // 면적 기준으로 내림차순 정렬
    piecesToPlace.sort((a, b) => (b.width * b.height) - (a.width * a.height));

    // 위치가 겹치는지 확인하는 함수 (간격 포함)
    const isOverlapping = (x: number, y: number, w: number, h: number): boolean => {
      const minGap = 10; // 최소 간격
      return occupiedAreas.some(area => 
        !(x >= area.x + area.width + minGap || x + w + minGap <= area.x || 
          y >= area.y + area.height + minGap || y + h + minGap <= area.y)
      );
    };

    // 배치 점수 계산 함수
    const calculatePositionScore = (x: number, y: number, orientation: { width: number; height: number; rotated: boolean }): number => {
      const distanceScore = Math.sqrt((x - MARGIN) ** 2 + (y - MARGIN) ** 2);
      let score = 10000 - distanceScore;
      
      if (!orientation.rotated) {
        score += 5;
      }
      
      const edgeBonus = Math.min(x - MARGIN, y - MARGIN, usableWidth - (x - MARGIN) - orientation.width, usableHeight - (y - MARGIN) - orientation.height);
      if (edgeBonus < SPACING) {
        score += 10;
      }
      
      return score;
    };

    // 각 도형 배치
    for (const piece of piecesToPlace) {
      let bestPosition = null;
      let bestScore = -1;

      const orientations = [
        { width: piece.width, height: piece.height, rotated: false },
        { width: piece.height, height: piece.width, rotated: true }
      ];

      for (const orientation of orientations) {
        if (orientation.width > usableWidth || orientation.height > usableHeight) continue;

        for (let y = MARGIN; y <= MARGIN + usableHeight - orientation.height; y += 20) {
          for (let x = MARGIN; x <= MARGIN + usableWidth - orientation.width; x += 20) {
            if (!isOverlapping(x, y, orientation.width, orientation.height)) {
              const positionScore = calculatePositionScore(x, y, orientation);
              
              if (positionScore > bestScore) {
                bestScore = positionScore;
                bestPosition = {
                  x, y,
                  width: orientation.width,
                  height: orientation.height,
                  rotated: orientation.rotated,
                  color: colors[piece.itemIndex % colors.length],
                  itemIndex: piece.itemIndex
                };
              }
            }
          }
        }
      }

      if (bestPosition) {
        positions.push(bestPosition);
        occupiedAreas.push({
          x: bestPosition.x,
          y: bestPosition.y,
          width: bestPosition.width,
          height: bestPosition.height
        });
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