
import React from 'react';
import { Button } from "@/components/ui/button";
import { Quality } from "@/types/calculator";

interface QualitySelectionProps {
  qualities: Quality[];
  selectedQuality: Quality | null;
  selectedFactory: string;
  onQualitySelect: (quality: Quality) => void;
}

const QualitySelection: React.FC<QualitySelectionProps> = ({
  qualities,
  selectedQuality,
  selectedFactory,
  onQualitySelect
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">특수 제작을 선택해주세요</h3>
        <p className="text-gray-600">원하시는 특수 제작 타입을 선택해주세요</p>
        {selectedFactory !== 'jangwon' && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">템플릿 모드: 실제 가격은 표시되지 않습니다.</p>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {qualities.map((quality) => (
          <Button
            key={quality.id}
            variant={selectedQuality?.id === quality.id ? "default" : "minimal"}
            className="h-16 text-lg font-semibold shadow-depth hover:shadow-smooth transform hover:scale-105 transition-all duration-200"
            onClick={() => onQualitySelect(quality)}
          >
            {quality.name}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default QualitySelection;
