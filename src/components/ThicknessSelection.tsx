
import React from 'react';
import { Button } from "@/components/ui/button";

interface ThicknessSelectionProps {
  thicknesses: string[];
  selectedThickness: string;
  onThicknessSelect: (thickness: string) => void;
}

const ThicknessSelection: React.FC<ThicknessSelectionProps> = ({
  thicknesses,
  selectedThickness,
  onThicknessSelect
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="mb-2 text-2xl font-semibold text-slate-950">두께를 선택해 주세요</h3>
        <p className="text-slate-500">필요한 판재의 두께를 선택해주세요</p>
      </div>
      <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
        {thicknesses.map((thickness) => (
          <Button
            key={thickness}
            variant="outline"
            className={`h-12 rounded-xl font-semibold transition-all duration-200 ${
              selectedThickness === thickness
                ? 'border-slate-950 bg-slate-950 text-white hover:bg-slate-800'
                : 'border-slate-200 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50'
            }`}
            onClick={() => onThicknessSelect(thickness)}
          >
            {thickness}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default ThicknessSelection;
