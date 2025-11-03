
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
        <h3 className="text-2xl font-bold text-gray-900 mb-2">두께를 선택해 주세요</h3>
        <p className="text-gray-600">필요한 판재의 두께를 선택해주세요</p>
      </div>
      <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
        {thicknesses.map((thickness) => (
          <Button
            key={thickness}
            variant={selectedThickness === thickness ? "default" : "minimal"}
            className="h-12 font-semibold shadow-depth hover:shadow-smooth transform hover:scale-105 transition-all duration-200"
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
