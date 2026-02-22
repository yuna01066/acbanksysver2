import React from 'react';

interface QuoteTotalSectionProps {
  subtotal: number;
  tax: number;
  totalWithTax: number;
}

const QuoteTotalSection: React.FC<QuoteTotalSectionProps> = ({ subtotal, tax, totalWithTax }) => {
  return (
    <div className="mb-6 rounded-lg bg-[hsl(220,30%,94%)] border border-[hsl(220,25%,82%)] print-total quote-section">
      <div className="p-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[14px] font-bold text-black bg-white px-4 py-2 rounded-lg border border-gray-200">총 견적 금액</h2>
          <div className="flex flex-col items-end gap-1.5 flex-1">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-gray-500">소계 (부가세 별도)</span>
                <span className="text-[14px] font-bold text-black">{subtotal.toLocaleString()}원</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-gray-500">부가세 (10%)</span>
                <span className="text-[14px] font-bold text-black">{tax.toLocaleString()}원</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 rounded-lg">
                <span className="text-[13px] font-bold text-white">총 합계</span>
                <span className="text-[18px] font-black text-white">{totalWithTax.toLocaleString()}원</span>
              </div>
            </div>
            <p className="text-[12px] text-gray-500">* 배송비는 별도 입니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteTotalSection;
