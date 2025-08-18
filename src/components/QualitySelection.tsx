
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
        <h3 className="text-2xl font-bold text-gray-900 mb-2">재질을 선택해주세요</h3>
        <p className="text-gray-600">원하시는 재질의 품질을 선택해주세요</p>
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
            variant={selectedQuality?.id === quality.id ? "default" : "outline"}
            className={`h-16 text-lg font-semibold transition-all duration-200 rounded-lg ${
              selectedQuality?.id === quality.id
                ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-900'
            }`}
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
