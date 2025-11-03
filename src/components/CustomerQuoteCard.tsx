
import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Minus } from "lucide-react";
import { formatPrice } from "@/utils/priceCalculations";
import { Quote } from "@/contexts/QuoteContext";

interface CustomerQuoteCardProps {
  quote: Quote;
  index: number;
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  isCustomerView?: boolean;
}

const CustomerQuoteCard = ({ quote, index, onRemove, onUpdateQuantity, isCustomerView = false }: CustomerQuoteCardProps) => {
  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity >= 1) {
      onUpdateQuantity(quote.id, newQuantity);
    }
  };

  const unitPrice = quote.totalPrice;
  const totalPrice = unitPrice * quote.quantity;

  return (
    <Card className="border border-gray-200">
      <CardHeader className="pb-4 bg-gray-50">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">견적 #{index + 1}</CardTitle>
          <div className="flex items-center gap-3">
            {/* 수량 조절 */}
            <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-300 px-3 py-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuantityChange(quote.quantity - 1)}
                className="w-8 h-8 p-0 border-0 hover:bg-gray-100"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                type="number"
                value={quote.quantity}
                onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                className="w-16 text-center border-0 h-8 p-0 text-sm font-semibold"
                min="1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuantityChange(quote.quantity + 1)}
                className="w-8 h-8 p-0 border-0 hover:bg-gray-100"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRemove(quote.id)}
              className="text-red-600 border-red-600 hover:bg-red-50 print:hidden"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {/* 선택한 옵션들 표시 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-600 mb-1">색상</div>
            <div className="flex items-center gap-2">
              {quote.selectedColorHex && (
                <div 
                  className="w-4 h-4 rounded border border-gray-300"
                  style={{ backgroundColor: quote.selectedColorHex }}
                />
              )}
              <span className="font-semibold text-gray-900 text-sm">{quote.selectedColor || '-'}</span>
            </div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-600 mb-1">소재</div>
            <div className="font-semibold text-gray-900 text-sm">{quote.material}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-600 mb-1">재질</div>
            <div className="font-semibold text-gray-900 text-sm">{quote.quality}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-600 mb-1">두께</div>
            <div className="font-semibold text-gray-900 text-sm">{quote.thickness}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-600 mb-1">사이즈</div>
            <div className="font-semibold text-gray-900 text-sm">{quote.size}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-600 mb-1">면수</div>
            <div className="font-semibold text-gray-900 text-sm">{quote.surface}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-600 mb-1">가공방법</div>
            <div className="font-semibold text-gray-900 text-sm">{quote.processingName}</div>
          </div>
        </div>

        {/* 가격 세부 내역 (단가) */}
        {quote.breakdown && quote.breakdown.length > 0 && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-sm font-semibold text-gray-900 mb-3">
              {isCustomerView ? '세부 내역' : '가격 세부 내역 (단가)'}
            </div>
            <div className="space-y-2">
              {quote.breakdown.map((item, idx) => {
                // 고객용일 때 괄호와 그 안의 내용 제거
                const displayLabel = isCustomerView 
                  ? item.label.replace(/\s*\([^)]*\)/g, '').trim()
                  : item.label;
                
                return (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">{displayLabel}</span>
                    {!isCustomerView && (
                      <span className="font-semibold text-gray-900">{formatPrice(item.price)}</span>
                    )}
                  </div>
                );
              })}
              {isCustomerView && (
                <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200">
                  <span className="text-gray-700 font-medium">합계금액 (단가)</span>
                  <span className="font-semibold text-gray-900">{formatPrice(unitPrice)}</span>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* 가격 정보 */}
        <div className="space-y-2 pt-3 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">단가</span>
            <span className="font-semibold text-gray-900">{formatPrice(unitPrice)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">수량</span>
            <span className="font-semibold text-gray-900">{quote.quantity}개</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <span className="text-gray-700 font-medium">소계</span>
            <span className="text-lg font-bold text-slate-900">{formatPrice(totalPrice)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CustomerQuoteCard;
