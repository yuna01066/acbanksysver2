
import React from 'react';
import { Button } from "@/components/ui/button";
import { SURFACE_OPTIONS } from "@/types/calculator";

interface SurfaceSelectionProps {
  selectedSurface: string;
  onSurfaceSelect: (surface: string) => void;
  isGlossyStandard: boolean;
  forceSingle?: boolean;
}

const SurfaceSelection: React.FC<SurfaceSelectionProps> = ({
  selectedSurface,
  onSurfaceSelect,
  isGlossyStandard,
  forceSingle = false
}) => {
  // 강제 단면 모드인 경우 자동으로 단면 선택
  React.useEffect(() => {
    if (forceSingle && selectedSurface !== '단면') {
      onSurfaceSelect('단면');
    }
  }, [forceSingle, selectedSurface, onSurfaceSelect]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="mb-2 text-2xl font-semibold text-slate-950">
          6. 면수를 선택해주세요
        </h3>
        <p className="text-slate-500">판재의 면수를 선택해주세요</p>
        {forceSingle && (
          <p className="mt-2 text-sm font-medium text-slate-700">선택한 컬러/재질은 단면만 가능합니다</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-6">
        {SURFACE_OPTIONS.map((option) => (
          <Button
            key={option.id}
            variant="outline"
            className={`h-20 rounded-xl text-xl font-semibold transition-all duration-200 ${
              selectedSurface === option.name
                ? 'border-slate-950 bg-slate-950 text-white hover:bg-slate-800'
                : 'border-slate-200 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50'
            }`}
            onClick={() => onSurfaceSelect(option.name)}
            disabled={forceSingle && option.name !== '단면'}
          >
            {option.name}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default SurfaceSelection;
