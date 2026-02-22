import React from 'react';

interface QuoteSummarySectionProps {
  quoteNumber: string;
  currentDate: string;
  itemCount: number;
  subtotal: number;
  tax: number;
  totalWithTax: number;
}

const QuoteSummarySection: React.FC<QuoteSummarySectionProps> = ({
  quoteNumber,
  currentDate,
  itemCount,
  subtotal,
  tax,
  totalWithTax,
}) => {
  return (
    <div className="mb-6 rounded-lg bg-[hsl(210,50%,94%)] border border-[hsl(210,40%,82%)] print-summary quote-section">
      <div className="p-5">
        <h2 className="text-[17px] font-bold text-black mb-4 pb-2 border-b border-[hsl(210,40%,75%)]">견적 요약</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <div className="bg-white rounded-lg p-3 border border-[hsl(210,30%,90%)]">
              <p className="text-[12px] font-semibold text-gray-500 mb-1">견적번호</p>
              <p className="text-[14px] font-bold text-black">{quoteNumber}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-[hsl(210,30%,90%)]">
              <p className="text-[12px] font-semibold text-gray-500 mb-1">작성일</p>
              <p className="text-[14px] font-bold text-black">{currentDate}</p>
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-3 border border-[hsl(210,30%,90%)] flex flex-col justify-center">
            <p className="text-[12px] font-semibold text-gray-500 mb-1">견적 항목 수</p>
            <div className="flex items-baseline gap-1">
              <p className="text-2xl font-black text-black">{itemCount}</p>
              <p className="text-[14px] font-medium text-black">개</p>
            </div>
          </div>
          
          <div className="space-y-2 bg-white rounded-lg p-3 border border-[hsl(210,30%,90%)]">
            <div className="flex justify-between items-center pb-2 border-b border-gray-200">
              <p className="text-[12px] font-semibold text-gray-500">공급가</p>
              <p className="text-[14px] font-bold text-black">{subtotal.toLocaleString()}원</p>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-gray-200">
              <p className="text-[12px] font-semibold text-gray-500">부가세</p>
              <p className="text-[14px] font-bold text-black">{tax.toLocaleString()}원</p>
            </div>
            <div className="flex justify-between items-center pt-1">
              <p className="text-[13px] font-bold text-black">최종 금액</p>
              <p className="text-[17px] font-black text-black">{totalWithTax.toLocaleString()}원</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteSummarySection;
