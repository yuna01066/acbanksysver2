
import React from 'react';
import { Button } from "@/components/ui/button";

interface ColorTypeSelectionProps {
  selectedColorType: string;
  onColorTypeSelect: (colorType: string) => void;
}

const ColorTypeSelection: React.FC<ColorTypeSelectionProps> = ({
  selectedColorType,
  onColorTypeSelect
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">색상타입을 선택해주세요</h3>
        <p className="text-gray-600">원하는 색상 종류를 선택해주세요</p>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Button
          variant={selectedColorType === '컬러' ? "default" : "outline"}
          className={`h-20 text-xl font-semibold transition-all duration-200 rounded-lg ${
            selectedColorType === '컬러'
              ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
              : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-900'
          }`}
          onClick={() => onColorTypeSelect('컬러')}
        >
          컬러
        </Button>
        <Button
          variant={selectedColorType === '진백' ? "default" : "outline"}
          className={`h-20 text-xl font-semibold transition-all duration-200 rounded-lg ${
            selectedColorType === '진백'
              ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
              : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-900'
          }`}
          onClick={() => onColorTypeSelect('진백')}
        >
          <div>
            <div>진백</div>
            <div className="text-base opacity-80">+추가금액</div>
          </div>
        </Button>
      </div>
    </div>
  );
};

export default ColorTypeSelection;
