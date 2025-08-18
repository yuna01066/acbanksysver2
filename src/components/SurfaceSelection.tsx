
import React from 'react';
import { Button } from "@/components/ui/button";
import { SURFACE_OPTIONS } from "@/types/calculator";

interface SurfaceSelectionProps {
  selectedSurface: string;
  onSurfaceSelect: (surface: string) => void;
  isGlossyStandard: boolean;
}

const SurfaceSelection: React.FC<SurfaceSelectionProps> = ({
  selectedSurface,
  onSurfaceSelect,
  isGlossyStandard
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          {isGlossyStandard ? '6.' : '5.'} 면수를 선택해주세요
        </h3>
        <p className="text-gray-600">판재의 면수를 선택해주세요</p>
      </div>
      <div className="grid grid-cols-2 gap-6">
        {SURFACE_OPTIONS.map((option) => (
          <Button
            key={option.id}
            variant={selectedSurface === option.name ? "default" : "outline"}
            className={`h-20 text-xl font-semibold transition-all duration-200 rounded-lg ${
              selectedSurface === option.name
                ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-900'
            }`}
            onClick={() => onSurfaceSelect(option.name)}
          >
            {option.name}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default SurfaceSelection;
