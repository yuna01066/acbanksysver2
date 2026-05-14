import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { calculateYieldPlan } from '@/utils/yieldOptimization';

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
  selectedThickness?: string;
}

const NestingThumbnail: React.FC<NestingThumbnailProps> = ({ 
  cutItems, 
  panelWidth, 
  panelHeight, 
  panelsNeeded,
  selectedThickness
}) => {
  const [currentPanelIndex, setCurrentPanelIndex] = useState(0);
  
  // 두께에 따른 간격 설정
  const thickness = parseFloat(selectedThickness?.replace('T', '') || '0');
  const SPACING = thickness < 10 ? 6 : 8; // 10T 미만: 6mm, 10T 이상: 8mm
  const THUMBNAIL_WIDTH = 400; // 썸네일 크기
  const THUMBNAIL_HEIGHT = 300;
  
  // 1/10 스케일 계산 (원판 mm 기준으로 정확히 1/10, 절대 변경 금지)
  const scale = 0.1;
  const scaledPanelWidth = panelWidth * scale;
  const scaledPanelHeight = panelHeight * scale;
  
  // 썸네일 크기는 고정 (240x180)
  const offsetX = (THUMBNAIL_WIDTH - scaledPanelWidth) / 2;
  const offsetY = (THUMBNAIL_HEIGHT - scaledPanelHeight) / 2;

  const panelLayouts = useMemo(() => {
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
      '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
    ];

    const numericItems = cutItems
      .map((item, index) => ({
        width: parseFloat(item.width),
        height: parseFloat(item.height),
        quantity: parseInt(item.quantity),
        id: `item-${index}`,
      }))
      .filter(item => item.width > 0 && item.height > 0 && item.quantity > 0);

    const plan = calculateYieldPlan(numericItems, panelWidth, panelHeight, selectedThickness);
    return plan.layoutPanels.slice(0, panelsNeeded).map(panel =>
      panel.positions.map(pos => {
        const itemIndex = parseInt(pos.itemId.replace('item-', ''));
        return {
          ...pos,
          color: colors[itemIndex % colors.length],
          itemIndex,
        };
      })
    );
  }, [cutItems, panelWidth, panelHeight, panelsNeeded, selectedThickness]);

  const currentLayout = panelLayouts[currentPanelIndex] || [];

  // 효율 계산
  const calculateEfficiency = () => {
    const totalCutArea = cutItems.reduce((sum, item) => {
      const cutW = parseFloat(item.width);
      const cutH = parseFloat(item.height);
      const qty = parseInt(item.quantity);
      return sum + (cutW * cutH * qty);
    }, 0);
    
    const panelArea = panelWidth * panelHeight;
    const totalPanelArea = panelArea * panelsNeeded;
    
    return totalPanelArea > 0 ? (totalCutArea / totalPanelArea) * 100 : 0;
  };
  
  const efficiency = calculateEfficiency();

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
            strokeWidth="0.5"
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
      
    </div>
  );
};

export default NestingThumbnail;
