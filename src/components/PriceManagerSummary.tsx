
import React from 'react';

interface PriceManagerSummaryProps {
  totalCombinations: number;
  setPrices: number;
}

const PriceManagerSummary: React.FC<PriceManagerSummaryProps> = ({
  totalCombinations,
  setPrices
}) => {
  const progressPercentage = (setPrices / totalCombinations) * 100;

  return (
    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
      <h3 className="font-medium mb-2">설정된 가격 현황</h3>
      <p className="text-sm text-gray-600">
        총 {totalCombinations}개 조합 중 {setPrices}개 가격 설정 완료
      </p>
      <div className="mt-2">
        <div className="bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default PriceManagerSummary;
