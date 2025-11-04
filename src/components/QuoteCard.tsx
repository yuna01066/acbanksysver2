
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Minus, Edit } from "lucide-react";
import { formatPrice } from "@/utils/priceCalculations";
import { Quote } from "@/contexts/QuoteContext";

interface QuoteCardProps {
  quote: Quote;
  index: number;
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  readOnly?: boolean;
}

const QuoteCard = ({ quote, index, onRemove, onUpdateQuantity, readOnly = false }: QuoteCardProps) => {
  const navigate = useNavigate();

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity >= 1) {
      onUpdateQuantity(quote.id, newQuantity);
    }
  };

  const handleEditQuote = () => {
    // 견적 데이터를 URL 파라미터로 전달하여 계산기로 이동
    const quoteParams = new URLSearchParams({
      factory: quote.factory,
      material: quote.material,
      quality: quote.quality,
      thickness: quote.thickness,
      size: quote.size,
      colorType: quote.colorType || '',
      surface: quote.surface,
      processing: quote.processing,
      quantity: quote.quantity.toString(),
      serialNumber: quote.serialNumber || '',
      editMode: 'true',
      editId: quote.id
    });
    
    navigate(`/?${quoteParams.toString()}`);
  };

  const unitPrice = quote.totalPrice;
  const totalPrice = unitPrice * quote.quantity;

  return (
    <Card className="border border-gray-200">
      <CardHeader className="pb-4 bg-gradient-to-r from-slate-900 to-slate-700 text-white print:bg-slate-900">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-xs text-slate-300 mb-1">아크뱅크 견적서</div>
            <CardTitle className="text-lg">견적 #{index + 1}</CardTitle>
          </div>
          {!readOnly && (
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
                onClick={handleEditQuote}
                className="text-blue-600 border-blue-600 hover:bg-blue-50 print:hidden"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRemove(quote.id)}
                className="text-red-600 border-red-600 hover:bg-red-50 print:hidden"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {/* 선택한 옵션들 표시 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-600 mb-1">색상</div>
            <div className="flex items-center gap-2">
              {quote.selectedColor && quote.selectedColorHex ? (
                <>
                  <div 
                    className="w-4 h-4 rounded border border-gray-300" 
                    style={{ backgroundColor: quote.selectedColorHex }}
                  ></div>
                  <div className="font-semibold text-gray-900 text-sm">{quote.selectedColor}</div>
                </>
              ) : (
                <div className="font-semibold text-gray-900 text-sm">AC-미선택</div>
              )}
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
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-600 mb-1">사이즈</div>
            <div className="font-semibold text-gray-900 text-sm">{quote.size}</div>
          </div>
          {quote.colorType && (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-xs text-gray-600 mb-1">색상</div>
              <div className="font-semibold text-gray-900 text-sm">{quote.colorType}</div>
            </div>
          )}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs text-gray-600 mb-1">면수</div>
            <div className="font-semibold text-gray-900 text-sm">{quote.surface}</div>
          </div>
          {quote.processing && (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 md:col-span-2">
              <div className="text-xs text-gray-600 mb-1">가공방법</div>
              <div className="font-semibold text-gray-900 text-sm">{quote.processingName}</div>
            </div>
          )}
          {quote.serialNumber && (
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="text-xs text-yellow-700 mb-1">클라이언트 요청사항</div>
              <div className="font-semibold text-yellow-900 text-sm">{quote.serialNumber}</div>
            </div>
          )}
        </div>
        
        {/* 가격 상세 내역 */}
        {quote.breakdown.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">가격 상세 내역 (단가)</h4>
            <div className="space-y-1">
              {quote.breakdown.map((item, itemIndex) => (
                <div key={itemIndex} className="flex justify-between text-sm py-1 px-2 bg-gray-50 rounded">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="font-medium text-gray-900">{formatPrice(item.price)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
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

export default QuoteCard;
