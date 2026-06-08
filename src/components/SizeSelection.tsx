
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
          className="border-2 border-gray-400 bg-gray-100 relative"
          style={{ 
            width: `${displayWidth}px`, 
            height: `${displayHeight}px`
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-600 font-medium">
            {sizeInfo.baseName}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">5. 판재 사이즈를 선택해주세요</h3>
        <p className="text-gray-600">원하는 판재의 크기를 선택해주세요</p>
      </div>
      {availableSizes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableSizes.map((size) => {
            const sizeInfo = getPanelSizeInfo(size);
            const isSelected = selectedSize === size;
            
            return (
              <div
                key={size}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
                  isSelected 
                    ? 'border-primary bg-primary/5 shadow-md' 
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
                onClick={() => onSizeSelect(size)}
              >
                <PanelThumbnail sizeInfo={sizeInfo} />
                <div className="text-center space-y-2">
                  <div className="font-semibold text-lg text-gray-900">
                    {sizeInfo.baseName}
                  </div>
                  <div className="text-sm text-gray-600">
                    <div>원장: {sizeInfo.baseWidth}×{sizeInfo.baseHeight}mm</div>
                    <div className="font-medium text-primary">
                      DB 기준정보
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    두께: {selectedThickness || 'N/A'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
          <div className="text-gray-500 text-lg mb-2 font-medium">사용 가능한 사이즈가 없습니다</div>
          <p className="text-gray-400">다른 두께를 선택해주세요</p>
        </div>
      )}
    </div>
  );
};

export default SizeSelection;
