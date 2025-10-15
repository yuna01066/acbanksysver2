import React from 'react';
import { Button } from "@/components/ui/button";

interface FilmBaseTypeSelectionProps {
  selectedBaseType: string;
  onBaseTypeSelect: (baseType: string, qualityId: string) => void;
}

const BASE_TYPE_OPTIONS = [
  { id: 'clear', name: 'Clear (클리어)', qualityId: 'glossy-color' },
  { id: 'bright', name: 'Bright (브라이트)', qualityId: 'satin-color' },
  { id: 'astel', name: 'Astel (아스텔)', qualityId: 'astel-color' }
];

const FilmBaseTypeSelection: React.FC<FilmBaseTypeSelectionProps> = ({
  selectedBaseType,
  onBaseTypeSelect
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          3. 기본 재질을 선택해주세요
        </h3>
        <p className="text-gray-600">필름 아크릴의 기본 재질을 선택해주세요</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {BASE_TYPE_OPTIONS.map((option) => (
          <Button
            key={option.id}
            variant={selectedBaseType === option.id ? "default" : "minimal"}
            className="h-16 text-lg font-semibold shadow-depth hover:shadow-smooth transform hover:scale-105 transition-all duration-200"
            onClick={() => onBaseTypeSelect(option.id, option.qualityId)}
          >
            {option.name}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default FilmBaseTypeSelection;
