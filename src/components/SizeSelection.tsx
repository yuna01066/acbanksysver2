
import React from 'react';
import { Button } from "@/components/ui/button";

interface PanelSizeInfo {
  baseName: string;
  baseWidth: number;
  baseHeight: number;
  availableWidth: number;
  availableHeight: number;
}

interface SizeSelectionProps {
  availableSizes: string[];
  selectedSize: string;
  onSizeSelect: (size: string) => void;
  selectedThickness?: string;
}

const SizeSelection: React.FC<SizeSelectionProps> = ({
  availableSizes,
  selectedSize,
  onSizeSelect,
  selectedThickness
}) => {
  // 두께에 따른 가용사이즈 계산
  const getPanelSizeInfo = (sizeString: string): PanelSizeInfo => {
    const match = sizeString.match(/^(.+?) \((\d+)\*(\d+)\)$/);
    if (match) {
      const baseName = match[1];
      const availableWidth = parseInt(match[2]);
      const availableHeight = parseInt(match[3]);

      return {
        baseName,
        baseWidth: availableWidth,
        baseHeight: availableHeight,
        availableWidth,
        availableHeight
      };
    }
    
    // 기본값 반환
    return {
      baseName: sizeString,
      baseWidth: 0,
      baseHeight: 0,
      availableWidth: 0,
      availableHeight: 0
    };
  };

  // 실제 비율을 유지하는 썸네일 컴포넌트
  const PanelThumbnail: React.FC<{ sizeInfo: PanelSizeInfo }> = ({ sizeInfo }) => {
    // 실제 비율 유지하면서 최대 크기 100px로 조정
    const maxSize = 100;
    const ratio = sizeInfo.availableWidth / sizeInfo.availableHeight;
    
    let displayWidth, displayHeight;
    if (ratio > 1) {
      // 가로가 더 긴 경우
      displayWidth = maxSize;
      displayHeight = maxSize / ratio;
    } else {
      // 세로가 더 긴 경우
      displayHeight = maxSize;
      displayWidth = maxSize * ratio;
    }
    
    return (
      <div className="flex justify-center mb-2">
        <div 
          className="relative border-2 border-slate-300 bg-slate-50"
          style={{ 
            width: `${displayWidth}px`, 
            height: `${displayHeight}px`
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-slate-600">
            {sizeInfo.baseName}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="mb-2 text-2xl font-semibold text-slate-950">5. 판재 사이즈를 선택해주세요</h3>
        <p className="text-slate-500">원하는 판재의 크기를 선택해주세요</p>
      </div>
      {availableSizes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableSizes.map((size) => {
            const sizeInfo = getPanelSizeInfo(size);
            const isSelected = selectedSize === size;
            
            return (
              <div
                key={size}
                className={`cursor-pointer rounded-xl border-2 p-4 transition-all duration-200 ${
                  isSelected 
                    ? 'border-slate-950 bg-slate-50 shadow-sm' 
                    : 'border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50'
                }`}
                onClick={() => onSizeSelect(size)}
              >
                <PanelThumbnail sizeInfo={sizeInfo} />
                <div className="text-center space-y-2">
                  <div className="text-lg font-semibold text-slate-950">
                    {sizeInfo.baseName}
                  </div>
                  <div className="text-sm text-slate-500">
                    <div>원장: {sizeInfo.baseWidth}×{sizeInfo.baseHeight}mm</div>
                    <div className="font-medium text-slate-900">
                      DB 기준정보
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    두께: {selectedThickness || 'N/A'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 py-12 text-center">
          <div className="mb-2 text-lg font-medium text-slate-500">사용 가능한 사이즈가 없습니다</div>
          <p className="text-slate-400">다른 두께를 선택해주세요</p>
        </div>
      )}
    </div>
  );
};

export default SizeSelection;
