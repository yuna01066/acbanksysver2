import React from 'react';
import { Button } from "@/components/ui/button";
import { Calculator, TrendingUp } from "lucide-react";

interface CalculatorTypeSelectionProps {
  onTypeSelect: (type: 'quote' | 'yield') => void;
}

const CalculatorTypeSelection: React.FC<CalculatorTypeSelectionProps> = ({
  onTypeSelect
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">계산기 유형을 선택해주세요</h3>
        <p className="text-gray-600">원하시는 계산기를 선택해주세요</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
        <Button
          variant="outline"
          className="h-32 flex-col gap-4 text-lg font-semibold transition-all duration-200 rounded-lg border-2 hover:border-green-500 hover:bg-green-50 opacity-50"
          onClick={() => alert('수율 계산기는 준비중입니다.')}
          disabled
        >
          <TrendingUp className="w-8 h-8 text-green-600" />
          <div className="text-center">
            <div className="font-semibold text-gray-900">수율 계산기</div>
            <div className="text-sm text-gray-600 mt-1">원자재 수율 계산 (준비중)</div>
          </div>
        </Button>
        
        <Button
          variant="outline"
          className="h-32 flex-col gap-4 text-lg font-semibold transition-all duration-200 rounded-lg border-2 hover:border-blue-500 hover:bg-blue-50"
          onClick={() => onTypeSelect('quote')}
        >
          <Calculator className="w-8 h-8 text-blue-600" />
          <div className="text-center">
            <div className="font-semibold text-gray-900">견적 계산기</div>
            <div className="text-sm text-gray-600 mt-1">판재 단가 및 견적 계산</div>
          </div>
        </Button>
      </div>
    </div>
  );
};

export default CalculatorTypeSelection;