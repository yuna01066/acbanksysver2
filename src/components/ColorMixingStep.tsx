
import React from 'react';
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";

interface ColorMixingStepProps {
  colorMixingCost: number;
  onColorMixingAdd: () => void;
  onColorMixingRemove: () => void;
  onNextStep: () => void;
  isGlossyStandard: boolean;
  isFilmAcrylic?: boolean;
}

const ColorMixingStep: React.FC<ColorMixingStepProps> = ({
  colorMixingCost,
  onColorMixingAdd,
  onColorMixingRemove,
  onNextStep,
  isGlossyStandard,
  isFilmAcrylic = false
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          7. 조색비 {isFilmAcrylic ? '' : '추가 (선택사항)'}
        </h3>
        <p className="text-gray-600">
          {isFilmAcrylic 
            ? '필름 아크릴은 기본 조색비가 포함됩니다' 
            : '특수 색상 조색이 필요한 경우 추가해주세요'}
        </p>
      </div>
      <div className="max-w-md mx-auto space-y-6">
        <div className="p-6 border border-gray-200 rounded-xl bg-gray-50 text-center">
          <div className="text-lg font-semibold text-gray-700 mb-2">조색비</div>
          <div className="text-3xl font-bold text-slate-900 mb-2">{colorMixingCost.toLocaleString()}원</div>
          <p className="text-sm text-gray-600">
            {isFilmAcrylic 
              ? '필름 아크릴 기본 조색비입니다' 
              : '특수 색상 조색 시 추가되는 비용입니다'}
          </p>
        </div>
        
        {!isFilmAcrylic && (
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={onColorMixingAdd}
              className="flex-1 h-12 font-medium bg-white hover:bg-gray-50 border-gray-200 text-gray-900 rounded-lg transition-all duration-200 hover:scale-105"
            >
              <Plus className="w-4 h-4 mr-1" />
              추가 (+10,000원)
            </Button>
            <Button
              variant="outline"
              onClick={onColorMixingRemove}
              disabled={colorMixingCost === 0}
              className="flex-1 h-12 font-medium bg-white hover:bg-gray-50 border-gray-200 text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-200 hover:scale-105"
            >
              <Minus className="w-4 h-4 mr-1" />
              제거 (-10,000원)
            </Button>
          </div>
        )}

        <div className="text-center pt-4">
          <Button
            onClick={onNextStep}
            className="px-8 py-3 text-lg font-semibold bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            다음 단계
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ColorMixingStep;
