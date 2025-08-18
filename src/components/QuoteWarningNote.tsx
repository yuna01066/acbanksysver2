
import React from 'react';

const QuoteWarningNote = () => {
  return (
    <div className="mt-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
      <h4 className="font-semibold text-yellow-800 mb-3">견적서 주의사항</h4>
      <ul className="text-sm text-yellow-700 space-y-1">
        <li>• 본 견적서는 선택하신 조건에 따른 예상 금액입니다.</li>
        <li>• 실제 주문 시 수량, 배송지, 추가 요구사항에 따라 금액이 변동될 수 있습니다.</li>
        <li>• 견적서 유효기간은 발행일로부터 30일입니다.</li>
        <li>• 배송비는 별도입니다.</li>
        <li>• 정확한 견적을 위해서는 별도 문의를 통해 확인해주시기 바랍니다.</li>
      </ul>
    </div>
  );
};

export default QuoteWarningNote;
