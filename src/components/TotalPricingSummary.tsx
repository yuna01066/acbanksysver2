
import React from 'react';
import { formatPrice } from "@/utils/priceCalculations";

interface TotalPricingSummaryProps {
  quotesLength: number;
  subtotal: number;
  tax: number;
  totalWithTax: number;
}

const TotalPricingSummary = ({ quotesLength, subtotal, tax, totalWithTax }: TotalPricingSummaryProps) => {
  return (
    <div className="bg-slate-900 rounded-xl p-6 text-white">
      <div className="space-y-4">
        <div>
          <h3 className="text-2xl font-bold mb-2">총 견적 금액</h3>
          <p className="text-slate-300">전체 {quotesLength}개 견적의 합계</p>
        </div>
        
        {/* 가격 상세 내역 */}
        <div className="space-y-3 bg-white/10 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-slate-200">소계 (부가세 별도)</span>
            <span className="text-xl font-semibold">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-200">부가세 (10%)</span>
            <span className="text-xl font-semibold">{formatPrice(tax)}</span>
          </div>
          <div className="border-t border-white/20 pt-3">
            <div className="flex justify-between items-center">
              <span className="text-white font-bold text-xl">총 합계</span>
              <span className="text-3xl font-bold text-white">{formatPrice(totalWithTax)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TotalPricingSummary;
