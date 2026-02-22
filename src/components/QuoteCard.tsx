
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
    <Card className="border border-gray-200 shadow-none rounded-lg" style={{ fontFamily: "'Apple SD Gothic Neo', sans-serif" }}>
      <CardHeader className="pb-3 bg-gray-100 text-black print:bg-gray-100 px-4 py-3">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-[11px] text-gray-500 mb-0.5">아크뱅크 견적서</div>
            <CardTitle className="text-[14px] font-bold text-black">견적 #{index + 1}</CardTitle>
          </div>
          {!readOnly && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white rounded-lg border border-gray-300 px-2 py-1.5">
                <Button variant="outline" size="sm" onClick={() => handleQuantityChange(quote.quantity - 1)} className="w-7 h-7 p-0 border-0 hover:bg-gray-100">
                  <Minus className="w-3.5 h-3.5" />
                </Button>
                <Input type="number" value={quote.quantity} onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)} className="w-14 text-center border-0 h-7 p-0 text-[12px] font-semibold" min="1" />
                <Button variant="outline" size="sm" onClick={() => handleQuantityChange(quote.quantity + 1)} className="w-7 h-7 p-0 border-0 hover:bg-gray-100">
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={handleEditQuote} className="text-blue-600 border-blue-600 hover:bg-blue-50 print:hidden h-7 w-7 p-0">
                <Edit className="w-3.5 h-3.5" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => onRemove(quote.id)} className="text-red-600 border-red-600 hover:bg-red-50 print:hidden h-7 w-7 p-0">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-3 px-4 pb-4">
        {/* 선택한 옵션들 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-[11px] text-gray-500 mb-0.5">색상</div>
            <div className="flex flex-col gap-1">
              {quote.selectedColor && quote.selectedColorHex ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded border border-gray-300" style={{ backgroundColor: quote.selectedColorHex }}></div>
                    <div className="font-semibold text-black text-[12px]">
                      {quote.colorType === 'CUSTOM' ? '맞춤 색상' : quote.selectedColor}
                    </div>
                  </div>
                  {quote.colorType === 'CUSTOM' && (
                    <div className="text-[11px] space-y-0.5 bg-blue-50 p-1.5 rounded border border-blue-200">
                      {quote.customColorName && <div className="text-blue-700"><span className="font-medium">팬톤:</span> {quote.customColorName}</div>}
                      {quote.customOpacity && <div className="text-blue-700"><span className="font-medium">투명도:</span> {quote.customOpacity}%</div>}
                      <div className="text-blue-700"><span className="font-medium">컬러:</span> {quote.selectedColorHex}</div>
                    </div>
                  )}
                </>
              ) : (
                <div className="font-semibold text-black text-[12px]">AC-미선택</div>
              )}
            </div>
          </div>
          <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-[11px] text-gray-500 mb-0.5">소재</div>
            <div className="font-semibold text-black text-[12px]">{quote.material}</div>
          </div>
          <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-[11px] text-gray-500 mb-0.5">재질</div>
            <div className="font-semibold text-black text-[12px]">{quote.quality}</div>
          </div>
          <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-[11px] text-gray-500 mb-0.5">두께</div>
            <div className="font-semibold text-black text-[12px]">{quote.thickness}</div>
          </div>
          <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-[11px] text-gray-500 mb-0.5">사이즈</div>
            <div className="font-semibold text-black text-[12px]">{quote.size}</div>
          </div>
          <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-[11px] text-gray-500 mb-0.5">면수</div>
            <div className="font-semibold text-black text-[12px]">{quote.surface}</div>
          </div>
          {quote.processing && (
            <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 md:col-span-2">
              <div className="text-[11px] text-gray-500 mb-0.5">가공방법</div>
              <div className="font-semibold text-black text-[12px]">{quote.processingName}</div>
            </div>
          )}
          {quote.serialNumber && (
            <div className="p-2.5 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="text-[11px] text-yellow-700 mb-0.5">클라이언트 요청사항</div>
              <div className="font-semibold text-yellow-900 text-[12px]">{quote.serialNumber}</div>
            </div>
          )}
        </div>
        
        {/* 가격 상세 내역 */}
        {quote.breakdown.length > 0 && (
          <div className="mb-3">
            <h4 className="text-[12px] font-semibold text-black mb-1.5">가격 상세 내역 (단가)</h4>
            <div className="space-y-0.5">
              {quote.breakdown.map((item, itemIndex) => (
                <div key={itemIndex} className="flex justify-between text-[12px] py-1 px-2 bg-gray-50 rounded">
                  <span className="text-gray-600 whitespace-pre-line">{item.label}</span>
                  <span className="font-semibold text-black">{formatPrice(item.price)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="space-y-1.5 pt-2 border-t border-gray-200">
          <div className="flex justify-between items-center text-[12px]">
            <span className="text-gray-500">단가</span>
            <span className="font-semibold text-black">{formatPrice(unitPrice)}</span>
          </div>
          <div className="flex justify-between items-center text-[12px]">
            <span className="text-gray-500">수량</span>
            <span className="font-semibold text-black">{quote.quantity}개</span>
          </div>
          <div className="flex justify-between items-center pt-1.5 border-t border-gray-200">
            <span className="text-black font-semibold text-[12px]">소계</span>
            <span className="text-[14px] font-bold text-black">{formatPrice(totalPrice)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuoteCard;
