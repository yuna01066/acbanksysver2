import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [currentPanelIndex, setCurrentPanelIndex] = useState(0);
  
  const MARGIN = 80;
  const SPACING = 50; // 정확히 50mm 간격 (변경 금지)
  const THUMBNAIL_WIDTH = 400; // 더 큰 썸네일 크기
  const THUMBNAIL_HEIGHT = 300;
  
  // 1/10 스케일 계산 (원판 mm 기준으로 정확히 1/10, 절대 변경 금지)
  const scale = 0.1;
  const scaledPanelWidth = panelWidth * scale;
  const scaledPanelHeight = panelHeight * scale;
  
  // 썸네일 크기는 고정 (240x180)
  const offsetX = (THUMBNAIL_WIDTH - scaledPanelWidth) / 2;
  const offsetY = (THUMBNAIL_HEIGHT - scaledPanelHeight) / 2;

  // 여러 원판에 걸쳐 배치 계산
  const calculateMultiPanelLayout = () => {
    const usableWidth = panelWidth - (MARGIN * 2);
    const usableHeight = panelHeight - (MARGIN * 2);
    
    // 모든 도형을 배열로 생성
    const allPieces: Array<{ width: number; height: number; itemIndex: number; pieceId: string }> = [];
    cutItems.forEach((item, index) => {
      const cutW = parseFloat(item.width);
      const cutH = parseFloat(item.height);
      const qty = parseInt(item.quantity);
      
      if (cutW && cutH && qty) {
        for (let i = 0; i < qty; i++) {
          allPieces.push({
            width: cutW,
            height: cutH,
            itemIndex: index,
            pieceId: `item-${index}-piece-${i}`
          });
        }
      }
    });
    
    // 면적 기준으로 내림차순 정렬
    allPieces.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
      '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
    ];
    
    // 각 원판별 배치 결과
    const panelLayouts: Array<Array<{ x: number; y: number; width: number; height: number; rotated: boolean; color: string; itemIndex: number }>> = [];
    let remainingPieces = [...allPieces];
    
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

    // 위치가 겹치는지 확인하는 함수 (정확히 50mm 간격 포함)
    const isOverlapping = (x: number, y: number, w: number, h: number, occupiedAreas: Array<{ x: number; y: number; width: number; height: number }>): boolean => {
      const minGap = SPACING; // 정확히 50mm 간격
      return occupiedAreas.some(area => 
        !(x >= area.x + area.width + minGap || x + w + minGap <= area.x || 
          y >= area.y + area.height + minGap || y + h + minGap <= area.y)
      );
    };

    // 원판별로 배치 시뮬레이션
    for (let panelIndex = 0; panelIndex < panelsNeeded; panelIndex++) {
      const currentPanelPositions: Array<{ x: number; y: number; width: number; height: number; rotated: boolean; color: string; itemIndex: number }> = [];
      const occupiedAreas: Array<{ x: number; y: number; width: number; height: number }> = [];
      const placedInThisPanel: string[] = [];
      
      // 현재 원판에 배치할 도형들
      const piecesToPlace = [...remainingPieces];
      
      for (const piece of piecesToPlace) {
        // 이미 배치된 도형은 건너뛰기
        if (placedInThisPanel.includes(piece.pieceId)) continue;
        
        let bestPosition = null;
        let bestScore = -1;
        
        // 가능한 배치 위치와 회전 시도 (최적화된 평가)
        const orientations = [
          { width: piece.width, height: piece.height, rotated: false },
          { width: piece.height, height: piece.width, rotated: true }
        ];
        
        // 각 방향에 대해 가능한 모든 위치 평가 (엄격한 경계 검사)
        for (const orientation of orientations) {
          // 사용 가능한 영역에 완전히 들어가는지 엄격하게 확인
          if (orientation.width > usableWidth || orientation.height > usableHeight) continue;
          
          // 가능한 모든 위치에서 배치 시도 (10mm 간격으로 더 세밀하게 검색)
          for (let y = MARGIN; y <= MARGIN + usableHeight - orientation.height; y += 10) {
            for (let x = MARGIN; x <= MARGIN + usableWidth - orientation.width; x += 10) {
              // 엄격한 경계 검사: 도형이 원판 경계 내부에만 배치되는지 확인
              if (x + orientation.width <= MARGIN + usableWidth && 
                  y + orientation.height <= MARGIN + usableHeight &&
                  !isOverlapping(x, y, orientation.width, orientation.height, occupiedAreas)) {
                // 이 위치의 점수 계산
                const positionScore = calculatePositionScore(x, y, orientation, usableWidth, usableHeight);
                
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
        
        // 최적 위치에 배치
        if (bestPosition) {
          currentPanelPositions.push(bestPosition);
          
          occupiedAreas.push({
            x: bestPosition.x,
            y: bestPosition.y,
            width: bestPosition.width,
            height: bestPosition.height
          });
          
          placedInThisPanel.push(piece.pieceId);
        }
      }
      
      // 배치된 도형들을 남은 도형 목록에서 제거
      remainingPieces = remainingPieces.filter(piece => !placedInThisPanel.includes(piece.pieceId));
      panelLayouts.push(currentPanelPositions);
      
      // 더 이상 배치할 도형이 없으면 중단
      if (remainingPieces.length === 0) break;
    }
    
    return panelLayouts;
  };

  const panelLayouts = calculateMultiPanelLayout();
  const currentLayout = panelLayouts[currentPanelIndex] || [];

  const handlePrevPanel = () => {
    setCurrentPanelIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextPanel = () => {
    setCurrentPanelIndex(prev => Math.min(panelLayouts.length - 1, prev + 1));
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
        
        {/* 현재 원판의 재단 도형들 */}
        {currentLayout.map((pos, index) => (
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
      {panelLayouts.length > 1 && (
        <>
          {/* 이전 버튼 */}
          {currentPanelIndex > 0 && (
            <button
              onClick={handlePrevPanel}
              className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-background/80 hover:bg-background border border-border rounded-full flex items-center justify-center transition-colors"
              aria-label="이전 원판"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
          )}
          
          {/* 다음 버튼 */}
          {currentPanelIndex < panelLayouts.length - 1 && (
            <button
              onClick={handleNextPanel}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-background/80 hover:bg-background border border-border rounded-full flex items-center justify-center transition-colors"
              aria-label="다음 원판"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
          
          {/* 원판 인디케이터 */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-background/80 text-xs px-2 py-1 rounded border border-border">
            {currentPanelIndex + 1} / {panelLayouts.length}
          </div>
        </>
      )}
      
      {/* 총 판 수 표시 */}
      <div className="absolute top-1 right-1 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded">
        ×{panelsNeeded}
      </div>
    </div>
  );
};

export default NestingThumbnail;