
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
        <h3 className="mb-2 text-2xl font-semibold text-slate-950">재질을 선택해주세요</h3>
        <p className="text-slate-500">원하시는 재질의 품질을 선택해주세요</p>
        {selectedFactory !== 'jangwon' && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-700">템플릿 모드: 실제 가격은 표시되지 않습니다.</p>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {qualities.map((quality) => {
          const isMirrorQuality = /mirror/i.test(quality.id);

          return (
            <Button
              key={quality.id}
              variant="outline"
              className={`h-auto min-h-16 flex-col items-start justify-center gap-1 rounded-xl text-left text-lg font-semibold transition-all duration-200 ${
                selectedQuality?.id === quality.id
                  ? 'border-slate-950 bg-slate-950 text-white hover:bg-slate-800'
                  : 'border-slate-200 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50'
              }`}
              onClick={() => onQualitySelect(quality)}
            >
              <span>{quality.name}</span>
              {isMirrorQuality && (
                <span className="text-xs font-medium opacity-80">미러증착 비용 포함</span>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default QualitySelection;
