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
    <div className="mb-6 rounded-lg border border-slate-200 bg-white print-summary quote-section">
      <div className="p-5">
        <h2 className="mb-4 border-b border-slate-200 pb-2 text-[15px] font-bold text-slate-950">견적 요약</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">견적번호</p>
              <p className="text-[13px] font-bold text-slate-950">{quoteNumber}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">작성일</p>
              <p className="text-[13px] font-bold text-slate-950">{currentDate}</p>
            </div>
          </div>
          
          <div className="flex flex-col justify-center rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">견적 항목 수</p>
            <div className="flex items-baseline gap-1">
              <p className="text-2xl font-black text-blue-700">{itemCount}</p>
              <p className="text-[13px] font-semibold text-slate-700">개</p>
            </div>
          </div>
          
          <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
            <div className="flex justify-between items-center pb-2 border-b border-gray-200">
              <p className="text-[12px] font-semibold text-slate-500">공급가</p>
              <p className="text-[14px] font-bold text-slate-950">{subtotal.toLocaleString()}원</p>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-gray-200">
              <p className="text-[12px] font-semibold text-slate-500">부가세</p>
              <p className="text-[14px] font-bold text-slate-950">{tax.toLocaleString()}원</p>
            </div>
            <div className="flex justify-between items-center pt-1">
              <p className="text-[13px] font-bold text-slate-950">최종 금액</p>
              <p className="text-[18px] font-black text-blue-700">{totalWithTax.toLocaleString()}원</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteSummarySection;
