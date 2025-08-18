
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/utils/priceCalculations";
import { Calculator, Receipt } from "lucide-react";

interface PriceBreakdownProps {
  totalPrice: number;
  breakdown: { label: string; price: number }[];
  isVisible: boolean;
}

const PriceBreakdown = ({ totalPrice, breakdown, isVisible }: PriceBreakdownProps) => {
  if (!isVisible || totalPrice === 0) {
    return null;
  }

  return (
    <Card className="mt-8 mb-8 border border-gray-200 bg-white shadow-sm rounded-xl overflow-hidden">
      <CardHeader className="pb-4 bg-slate-900 text-white rounded-t-xl">
        <CardTitle className="text-xl font-bold flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calculator className="w-6 h-6" />
            가격 계산 결과
          </div>
          <Badge className="text-lg font-bold bg-white/20 text-white border-0 px-4 py-2 rounded-lg">
            {formatPrice(totalPrice)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 px-6 pb-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-5 h-5 text-gray-600" />
            <h4 className="font-semibold text-lg text-gray-900">가격 구성 내역</h4>
          </div>
          <div className="space-y-3">
            {breakdown.map((item, index) => (
              <div 
                key={index} 
                className="flex justify-between items-center py-3 px-4 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors duration-200"
              >
                <span className="text-gray-700 font-medium">
                  {item.label}
                </span>
                <span className="text-gray-900 font-semibold">
                  {formatPrice(item.price)}
                </span>
              </div>
            ))}
          </div>
          
          {/* 총 가격 강조 */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center py-4 px-6 bg-slate-900 rounded-xl text-white">
              <span className="text-xl font-bold">최종 견적가</span>
              <span className="text-2xl font-bold">{formatPrice(totalPrice)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PriceBreakdown;
