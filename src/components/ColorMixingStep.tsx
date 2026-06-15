
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
        <h3 className="mb-2 text-2xl font-semibold text-slate-950">
          7. 조색비 {isFilmAcrylic ? '' : '추가 (선택사항)'}
        </h3>
        <p className="text-slate-500">
          {isFilmAcrylic 
            ? '필름 아크릴은 기본 조색비가 포함됩니다' 
            : '특수 색상 조색이 필요한 경우 추가해주세요'}
        </p>
      </div>
      <div className="max-w-md mx-auto space-y-6">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
          <div className="mb-2 text-lg font-semibold text-slate-700">조색비</div>
          <div className="text-3xl font-bold text-slate-900 mb-2">{colorMixingCost.toLocaleString()}원</div>
          <p className="text-sm text-slate-500">
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
              className="h-12 flex-1 rounded-lg border-slate-200 bg-white font-medium text-slate-900 transition-all duration-200 hover:border-slate-400 hover:bg-slate-50"
            >
              <Plus className="w-4 h-4 mr-1" />
              추가 (+10,000원)
            </Button>
            <Button
              variant="outline"
              onClick={onColorMixingRemove}
              disabled={colorMixingCost === 0}
              className="h-12 flex-1 rounded-lg border-slate-200 bg-white font-medium text-slate-900 transition-all duration-200 hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Minus className="w-4 h-4 mr-1" />
              제거 (-10,000원)
            </Button>
          </div>
        )}

        <div className="text-center pt-4">
          <Button
            onClick={onNextStep}
            className="rounded-lg bg-slate-950 px-8 py-3 text-lg font-semibold text-white transition-all duration-200 hover:bg-slate-800"
          >
            다음 단계
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ColorMixingStep;
