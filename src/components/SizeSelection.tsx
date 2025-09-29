
import React from 'react';
import { Button } from "@/components/ui/button";

interface SizeSelectionProps {
  availableSizes: string[];
  selectedSize: string;
  onSizeSelect: (size: string) => void;
}

const SizeSelection: React.FC<SizeSelectionProps> = ({
  availableSizes,
  selectedSize,
  onSizeSelect
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">5. 판재 사이즈를 선택해주세요</h3>
        <p className="text-gray-600">원하는 판재의 크기를 선택해주세요</p>
      </div>
      {availableSizes.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {availableSizes.map((size) => (
            <Button
              key={size}
              variant={selectedSize === size ? "default" : "minimal"}
              size="lg"
              className="h-14 text-lg font-semibold shadow-depth hover:shadow-smooth transform hover:scale-105 transition-all duration-200"
              onClick={() => onSizeSelect(size)}
            >
              {size}
            </Button>
          ))}
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
