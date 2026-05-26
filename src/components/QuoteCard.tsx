
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Minus, Edit, FileText, ShieldCheck } from "lucide-react";
import { formatPrice } from "@/utils/priceCalculations";
import { Quote } from "@/contexts/QuoteContext";
import { getQuoteStyleForItem, getQuoteStyleProfile } from "@/utils/quoteStyle";
import { formatPricingVersionDisplayName } from "@/utils/pricingVersionDisplay";
import { isPanelStockSummaryValue, isPanelSurfaceSummaryValue } from "@/utils/quoteOptionDisplay";

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
    const quoteStyleForEdit = getQuoteStyleForItem(quote);
    const quoteParams = new URLSearchParams({
      type: 'quote',
      factory: quote.factory,
      material: quote.material,
      quality: quote.quality,
      thickness: quote.thickness,
      size: quote.size,
      colorType: quote.colorType || '',
      selectedColor: quote.selectedColor || '',
      selectedColorHex: quote.selectedColorHex || '',
      customColorName: quote.customColorName || '',
      customOpacity: quote.customOpacity || '',
      surface: quote.surface,
      colorMixingCost: String(quote.colorMixingCost ?? 0),
      processing: quote.processing,
      quantity: quote.quantity.toString(),
      serialNumber: quote.serialNumber || '',
      quoteStyle: quoteStyleForEdit,
      totalPrice: String(quote.totalPrice ?? 0),
      editMode: 'draft',
      draftQuoteId: quote.id
    });

    if (quoteStyleForEdit === 'fabrication') {
      const manualProductItem = quote.calculationSnapshot?.selectedOptions?.manualProductItem;
      const itemNumberMatch = quote.processingName?.match(/^\[([^\]]+)\]\s*(.*)$/);
      const fallbackManualItem = {
        id: quote.id,
        itemNumber: itemNumberMatch?.[1] || '',
        name: itemNumberMatch?.[2] || quote.processingName || '제품 제작',
        quantity: 1,
        unitPrice: quote.totalPrice || 0,
        sizeWidth: '',
        sizeHeight: '',
        sizeDepth: '',
        material: quote.quality || '',
        thickness: quote.thickness || '',
        color: quote.selectedColor || '',
        colorHex: quote.selectedColorHex || '',
        surfaceType: quote.surface || '',
        productType: '',
        bondingMethod: '',
        notes: quote.breakdown?.map(item => `${item.label}: ${formatPrice(item.price)}`).join('\n') || '',
      };

      const restoredManualItem = manualProductItem && typeof manualProductItem === 'object'
        ? { ...fallbackManualItem, ...(manualProductItem as Record<string, unknown>) }
        : fallbackManualItem;

      quoteParams.set('manualProductItem', JSON.stringify(restoredManualItem));
    }
    
    navigate(`/calculator?${quoteParams.toString()}`);
  };

  const unitPrice = quote.totalPrice;
  const totalPrice = unitPrice * quote.quantity;
  const snapshot = quote.calculationSnapshot;
  const snapshotCapturedAt = snapshot?.capturedAt ? new Date(snapshot.capturedAt) : null;
  const rawSnapshotVersionName = snapshot?.pricingVersion?.versionName || quote.pricingVersionName;
  const snapshotVersionName = formatPricingVersionDisplayName({
    versionName: rawSnapshotVersionName,
    supplierName: snapshot?.pricingVersion?.supplierName,
    effectiveFrom: snapshot?.pricingVersion?.effectiveFrom,
    capturedAt: snapshot?.capturedAt,
  });
  const yieldRecommendation = snapshot?.selectedOptions?.yieldRecommendation as any;
  const quoteStyle = getQuoteStyleForItem(quote);
  const styleProfile = getQuoteStyleProfile(quoteStyle);
  const isFabrication = quoteStyle === 'fabrication';
  const quoteTitle = isFabrication
    ? quote.processingName || `제품 제작 #${index + 1}`
    : `견적 #${index + 1}`;
  const shouldHideStockSize = !isFabrication && isPanelStockSummaryValue(quote.size);
  const shouldHideStockSurface = !isFabrication && isPanelSurfaceSummaryValue(quote.surface);
  const visibleOptions = [
    {
      label: '색상',
      value: quote.colorType === 'CUSTOM' ? (quote.customColorName || '맞춤 색상') : (quote.selectedColor || quote.colorType || 'AC-미선택'),
      swatch: quote.selectedColorHex,
    },
    { label: isFabrication ? '견적 기준' : '소재', value: quote.material },
    { label: isFabrication ? '소재' : '재질', value: quote.quality },
    { label: '두께', value: quote.thickness },
    ...(!shouldHideStockSize ? [{ label: isFabrication ? '규격' : '사이즈', value: quote.size }] : []),
    ...(!shouldHideStockSurface ? [{ label: isFabrication ? '마감/면' : '면수', value: quote.surface }] : []),
    ...(quote.processing ? [
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
      <CardContent className="px-4 py-3">
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
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
        
        {/* 가격 상세 내역 */}
        {quote.breakdown.length > 0 && (
          <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                <h4 className="text-[12px] font-semibold text-slate-950">계산 근거</h4>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {(rawSnapshotVersionName || snapshotCapturedAt) && (
                  <span className="rounded-full border bg-white px-2 py-0.5 text-[11px] text-gray-600">
                    {snapshotVersionName}
                  </span>
                )}
                {snapshotCapturedAt && (
                  <span className="rounded-full border bg-white px-2 py-0.5 text-[11px] text-gray-600">
                    {snapshotCapturedAt.toLocaleDateString('ko-KR')}
                  </span>
                )}
              </div>
            </div>
            {snapshot?.note && (
              <div className="mb-2 flex items-start gap-1.5 rounded-md border border-blue-100 bg-blue-50 px-2 py-1.5 text-[11px] text-blue-700">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {snapshot.note}
              </div>
            )}
            {yieldRecommendation && (
              <div className="mb-2 rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-800">
                <div className="font-semibold">수율계산 근거</div>
                <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                  <span>추천: {yieldRecommendation.recommendationType === 'combination' ? '복합 원판' : '단일 원판'}</span>
                  <span>효율: {Number(yieldRecommendation.efficiency || 0).toFixed(1)}%</span>
                  <span>원판: {(yieldRecommendation.panels || []).map((panel: any) => `${panel.size} ${panel.quantity}장`).join(', ')}</span>
                  <span>재단품목: {(yieldRecommendation.cutItems || []).length}종</span>
                  {yieldRecommendation.largestReusableRect && (
                    <span className="col-span-2">
                      재활용 잔재 최대: {Number(yieldRecommendation.largestReusableRect.width || 0).toFixed(0)}
                      ×{Number(yieldRecommendation.largestReusableRect.height || 0).toFixed(0)}mm
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {quote.breakdown.map((item, itemIndex) => (
                <div key={itemIndex} className="flex justify-between gap-3 rounded-md border border-slate-100 bg-white px-2 py-1.5 text-[12px]">
                  <span className="text-slate-600 whitespace-pre-line">{item.label}</span>
                  <span className="shrink-0 font-semibold text-slate-950">{formatPrice(item.price)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QuoteCard;
