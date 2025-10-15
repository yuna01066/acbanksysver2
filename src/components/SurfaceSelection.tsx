
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
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          6. 면수를 선택해주세요
        </h3>
        <p className="text-gray-600">판재의 면수를 선택해주세요</p>
        {forceSingle && (
          <p className="text-sm text-blue-600 mt-2">브라이트/아스텔은 단면만 가능합니다</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-6">
        {SURFACE_OPTIONS.map((option) => (
          <Button
            key={option.id}
            variant={selectedSurface === option.name ? "default" : "minimal"}
            className="h-20 text-xl font-semibold shadow-depth hover:shadow-smooth transform hover:scale-105 transition-all duration-200"
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
