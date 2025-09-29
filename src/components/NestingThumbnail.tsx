import React from 'react';

interface CutItem {
  width: string;
  height: string;
  quantity: string;
}

interface NestingThumbnailProps {
  cutItems: CutItem[];
  panelWidth: number;
  panelHeight: number;
  panelsNeeded: number;
}

const NestingThumbnail: React.FC<NestingThumbnailProps> = ({ 
  cutItems, 
  panelWidth, 
  panelHeight, 
  panelsNeeded 
}) => {
  const MARGIN = 80;
  const SPACING = 50;
  const THUMBNAIL_WIDTH = 200;
  const THUMBNAIL_HEIGHT = 150;
  
  // 스케일 계산 (원판이 썸네일에 맞도록)
  const scaleX = THUMBNAIL_WIDTH / panelWidth;
  const scaleY = THUMBNAIL_HEIGHT / panelHeight;
  const scale = Math.min(scaleX, scaleY) * 0.9; // 여백을 위해 0.9 곱함
  
  const scaledPanelWidth = panelWidth * scale;
  const scaledPanelHeight = panelHeight * scale;
  
  // 중앙 정렬을 위한 오프셋
  const offsetX = (THUMBNAIL_WIDTH - scaledPanelWidth) / 2;
  const offsetY = (THUMBNAIL_HEIGHT - scaledPanelHeight) / 2;

  // 복합 네스팅 알고리즘으로 배치 계산
  const calculateComplexLayout = () => {
    const MARGIN = 80;
    const SPACING = 50;
    
    const usableWidth = panelWidth - (MARGIN * 2);
    const usableHeight = panelHeight - (MARGIN * 2);
    
    // 모든 도형을 크기 순(면적)으로 정렬하여 큰 것부터 배치
    const allPieces: Array<{ width: number; height: number; itemIndex: number }> = [];
    cutItems.forEach((item, index) => {
      const cutW = parseFloat(item.width);
      const cutH = parseFloat(item.height);
      const qty = parseInt(item.quantity);
      
      if (cutW && cutH && qty) {
        for (let i = 0; i < qty; i++) {
          allPieces.push({
            width: cutW,
            height: cutH,
            itemIndex: index
          });
        }
      }
    });
    
    // 면적 기준으로 내림차순 정렬
    allPieces.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    
    const positions: Array<{ x: number; y: number; width: number; height: number; rotated: boolean; color: string }> = [];
    const occupiedAreas: Array<{ x: number; y: number; width: number; height: number }> = [];
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
    
    // 위치가 겹치는지 확인하는 함수
    const isOverlapping = (x: number, y: number, w: number, h: number): boolean => {
      return occupiedAreas.some(area => 
        !(x >= area.x + area.width || x + w <= area.x || y >= area.y + area.height || y + h <= area.y)
      );
    };
    
    // 각 도형 배치 시도
    for (const piece of allPieces) {
      let placed = false;
      
      // 가능한 배치 위치와 회전 시도
      const orientations = [
        { width: piece.width, height: piece.height, rotated: false },
        { width: piece.height, height: piece.width, rotated: true }
      ];
      
      for (const orientation of orientations) {
        if (placed) break;
        
        // 사용 가능한 영역에 들어가는지 확인
        if (orientation.width > usableWidth || orientation.height > usableHeight) continue;
        
        // 가능한 모든 위치에서 배치 시도 (정확한 간격으로)
        for (let y = MARGIN; y <= MARGIN + usableHeight - orientation.height && !placed; y += SPACING) {
          for (let x = MARGIN; x <= MARGIN + usableWidth - orientation.width && !placed; x += SPACING) {
            if (!isOverlapping(x, y, orientation.width, orientation.height)) {
              // 배치 가능한 위치 발견
              positions.push({
                x,
                y,
                width: orientation.width,
                height: orientation.height,
                rotated: orientation.rotated,
                color: colors[piece.itemIndex % colors.length]
              });
              
              occupiedAreas.push({
                x,
                y,
                width: orientation.width,
                height: orientation.height
              });
              
              placed = true;
            }
          }
        }
      }
      
      // 배치하지 못한 도형이 있으면 중단
      if (!placed) {
        break;
      }
    }
    
    return positions;
  };

  const allPositions = calculateComplexLayout();

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
        
        {/* 재단 도형들 */}
        {allPositions.map((pos, index) => (
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
      
      {/* 판 수 표시 */}
      {panelsNeeded > 1 && (
        <div className="absolute top-1 right-1 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded">
          ×{panelsNeeded}
        </div>
      )}
    </div>
  );
};

export default NestingThumbnail;