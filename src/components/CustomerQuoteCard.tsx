
import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Minus } from "lucide-react";
import { formatPrice } from "@/utils/priceCalculations";
import { Quote } from "@/contexts/QuoteContext";
import { getQuoteStyleForItem, getQuoteStyleProfile } from "@/utils/quoteStyle";

interface CustomerQuoteCardProps {
  quote: Quote;
  index: number;
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  isCustomerView?: boolean;
  readOnly?: boolean;
}

const CustomerQuoteCard = ({ quote, index, onRemove, onUpdateQuantity, isCustomerView = false, readOnly = false }: CustomerQuoteCardProps) => {
  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity >= 1) {
      onUpdateQuantity(quote.id, newQuantity);
    }
  };

  const unitPrice = quote.totalPrice;
  const totalPrice = unitPrice * quote.quantity;
  const quoteStyle = getQuoteStyleForItem(quote);
  const styleProfile = getQuoteStyleProfile(quoteStyle);
  const isFabrication = quoteStyle === 'fabrication';
  const quoteTitle = isFabrication
    ? quote.processingName || `제품 제작 #${index + 1}`
    : `견적 #${index + 1}`;
  const visibleOptions = [
    {
      label: '색상',
      value: quote.colorType === 'CUSTOM' ? (quote.customColorName || '맞춤 색상') : (quote.selectedColor || quote.colorType || '-'),
      swatch: quote.selectedColorHex,
    },
    { label: isFabrication ? '견적 기준' : '소재', value: quote.material },
    { label: isFabrication ? '소재' : '재질', value: quote.quality },
    { label: '두께', value: quote.thickness },
    ...((!isCustomerView || isFabrication) ? [
      { label: isFabrication ? '규격' : '사이즈', value: quote.size },
      { label: isFabrication ? '마감/면' : '면수', value: quote.surface },
    ] : []),
    ...(quote.processing && (!isCustomerView || isFabrication) ? [
      { label: isFabrication ? '제작 품목' : '가공방법', value: quote.processingName },
    ] : []),
  ];

  return (
    <Card className="break-inside-avoid rounded-lg border border-slate-200 bg-white shadow-none quote-item-card">
      <CardHeader className="border-b border-slate-100 bg-white px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1 text-[11px] font-semibold text-blue-700">{styleProfile.label}</div>
            <CardTitle className="text-[14px] font-bold text-slate-950">{quoteTitle}</CardTitle>
            {quote.serialNumber && (
              <div className="mt-1 text-[12px] font-medium text-amber-700">{quote.serialNumber}</div>
            )}
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
              <Button variant="outline" size="sm" onClick={() => onRemove(quote.id)} className="text-red-600 border-red-600 hover:bg-red-50 print:hidden h-7 w-7 p-0">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-1.5">
              {visibleOptions.map((option, optionIndex) => (
                <span key={`${option.label}-${optionIndex}`} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px]">
                  {option.swatch && <span className="h-3 w-3 rounded-full border border-slate-300" style={{ backgroundColor: option.swatch }} />}
                  <span className="font-semibold text-slate-500">{option.label}</span>
                  <span className="font-bold text-slate-950">{option.value || '-'}</span>
                </span>
              ))}
            </div>
            {quote.colorType === 'CUSTOM' && quote.selectedColorHex && (
              <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 px-2 py-1.5 text-[11px] text-blue-700">
                {quote.customOpacity && <span className="mr-3"><span className="font-medium">투명도:</span> {quote.customOpacity}%</span>}
                <span><span className="font-medium">컬러:</span> {quote.selectedColorHex}</span>
              </div>
            )}
          </div>
          <div className="grid min-w-[210px] gap-1.5 text-[12px]">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">단가</span>
              <span className="font-semibold text-slate-950">{formatPrice(unitPrice)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">수량</span>
              <span className="font-semibold text-slate-950">{quote.quantity}개</span>
            </div>
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-1.5">
              <span className="font-semibold text-slate-950">소계</span>
              <span className="text-[15px] font-black text-blue-700">{formatPrice(totalPrice)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CustomerQuoteCard;
