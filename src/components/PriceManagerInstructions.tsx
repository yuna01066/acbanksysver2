
import React from 'react';

const PriceManagerInstructions: React.FC = () => {
  return (
    <div className="mb-4 p-4 bg-blue-50 rounded-lg">
      <h3 className="font-medium mb-2">사용 방법</h3>
      <p className="text-sm text-gray-600">
        각 조합별로 가격을 클릭하여 편집할 수 있습니다. 
        가격은 원 단위로 입력해주세요. (예: 21100)
        "유광 색상판 가격 로드" 버튼을 클릭하여 미리 설정된 가격표를 불러올 수 있습니다.
        양면 가격은 단면 가격에 양단면 추가금이 자동으로 추가됩니다.
      </p>
    </div>
  );
};

export default PriceManagerInstructions;
