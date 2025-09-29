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

  // 각 도형별 배치 계산
  const calculateLayout = (cutW: number, cutH: number, qty: number) => {
    const usableWidth = panelWidth - (MARGIN * 2);
    const usableHeight = panelHeight - (MARGIN * 2);
    
    if (usableWidth < cutW || usableHeight < cutH) {
      return [];
    }
    
    // 90도 회전을 고려한 최적 배치 계산
    const layout1 = {
      horizontal: Math.floor((usableWidth + SPACING) / (cutW + SPACING)),
      vertical: Math.floor((usableHeight + SPACING) / (cutH + SPACING)),
      rotated: false
    };
    
    const layout2 = {
      horizontal: Math.floor((usableWidth + SPACING) / (cutH + SPACING)),
      vertical: Math.floor((usableHeight + SPACING) / (cutW + SPACING)),
      rotated: true
    };

    const pieces1 = layout1.horizontal * layout1.vertical;
    const pieces2 = layout2.horizontal * layout2.vertical;
    
    const bestLayout = pieces1 >= pieces2 ? layout1 : layout2;
    
    // 실제 배치 위치 계산
    const positions = [];
    const actualWidth = bestLayout.rotated ? cutH : cutW;
    const actualHeight = bestLayout.rotated ? cutW : cutH;
    
    for (let row = 0; row < bestLayout.vertical; row++) {
      for (let col = 0; col < bestLayout.horizontal; col++) {
        if (positions.length >= qty) break;
        
        positions.push({
          x: MARGIN + col * (actualWidth + SPACING),
          y: MARGIN + row * (actualHeight + SPACING),
          width: actualWidth,
          height: actualHeight,
          rotated: bestLayout.rotated
        });
      }
      if (positions.length >= qty) break;
    }
    
    return positions;
  };

  // 모든 도형들의 배치 계산
  const allPositions: Array<{ x: number; y: number; width: number; height: number; rotated: boolean; color: string }> = [];
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
  
  cutItems.forEach((item, index) => {
    const cutW = parseFloat(item.width);
    const cutH = parseFloat(item.height);
    const qty = parseInt(item.quantity);
    
    if (cutW && cutH && qty) {
      const positions = calculateLayout(cutW, cutH, qty);
      positions.forEach(pos => {
        allPositions.push({
          ...pos,
          color: colors[index % colors.length]
        });
      });
    }
  });

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