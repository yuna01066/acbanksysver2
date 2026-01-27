import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Minus, ChevronDown, ChevronUp, Calculator } from "lucide-react";
import { formatPrice } from "@/utils/priceCalculations";

interface BreakdownItem {
  label: string;
  price: number;
}

interface QuoteItem {
  id: string;
  factory: string;
  material: string;
  quality: string;
  thickness: string;
  size: string;
  colorType?: string;
  selectedColor?: string;
  selectedColorHex?: string;
  customColorName?: string;
  customOpacity?: string;
  surface: string;
  colorMixingCost: number;
  processing: string;
  processingName: string;
  totalPrice: number;
  quantity: number;
  breakdown: BreakdownItem[];
  serialNumber?: string;
}

interface EditableQuoteItemProps {
  item: QuoteItem;
  index: number;
  onUpdate: (index: number, updatedItem: QuoteItem) => void;
  onRemove: (index: number) => void;
  quoteId?: string;
}

const EditableQuoteItem = ({ item, index, onUpdate, onRemove, quoteId }: EditableQuoteItemProps) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [editedItem, setEditedItem] = useState<QuoteItem>(item);

  const handleEditInCalculator = () => {
    // 견적 데이터를 URL 파라미터로 전달하여 계산기로 이동
    const quoteParams = new URLSearchParams({
      type: 'quote',
      factory: editedItem.factory || '',
      material: editedItem.material || '',
      quality: editedItem.quality || '',
      thickness: editedItem.thickness || '',
      size: editedItem.size || '',
      colorType: editedItem.colorType || '',
      surface: editedItem.surface || '',
      colorMixingCost: String(editedItem.colorMixingCost ?? 0),
      processing: editedItem.processing || '',
      quantity: editedItem.quantity.toString(),
      serialNumber: editedItem.serialNumber || '',
      editMode: 'saved',
      savedQuoteId: quoteId || '',
      itemIndex: index.toString()
    });
    
    navigate(`/calculator?${quoteParams.toString()}`);
  };

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity >= 1) {
      const updated = { ...editedItem, quantity: newQuantity };
      setEditedItem(updated);
      onUpdate(index, updated);
    }
  };

  const handleTotalPriceChange = (newPrice: number) => {
    const updated = { ...editedItem, totalPrice: newPrice };
    setEditedItem(updated);
    onUpdate(index, updated);
  };

  const handleBreakdownChange = (breakdownIndex: number, field: 'label' | 'price', value: string | number) => {
    const newBreakdown = [...editedItem.breakdown];
    if (field === 'price') {
      newBreakdown[breakdownIndex] = { ...newBreakdown[breakdownIndex], price: Number(value) };
    } else {
      newBreakdown[breakdownIndex] = { ...newBreakdown[breakdownIndex], label: String(value) };
    }
    
    // 총 단가 자동 계산
    const newTotalPrice = newBreakdown.reduce((sum, b) => sum + b.price, 0);
    const updated = { ...editedItem, breakdown: newBreakdown, totalPrice: newTotalPrice };
    setEditedItem(updated);
    onUpdate(index, updated);
  };

  const handleAddBreakdown = () => {
    const newBreakdown = [...editedItem.breakdown, { label: '새 항목', price: 0 }];
    const updated = { ...editedItem, breakdown: newBreakdown };
    setEditedItem(updated);
    onUpdate(index, updated);
  };

  const handleRemoveBreakdown = (breakdownIndex: number) => {
    const newBreakdown = editedItem.breakdown.filter((_, i) => i !== breakdownIndex);
    const newTotalPrice = newBreakdown.reduce((sum, b) => sum + b.price, 0);
    const updated = { ...editedItem, breakdown: newBreakdown, totalPrice: newTotalPrice };
    setEditedItem(updated);
    onUpdate(index, updated);
  };

  const handleFieldChange = (field: keyof QuoteItem, value: string) => {
    const updated = { ...editedItem, [field]: value };
    setEditedItem(updated);
    onUpdate(index, updated);
  };

  const unitPrice = editedItem.totalPrice;
  const totalPrice = unitPrice * editedItem.quantity;

  return (
    <Card className="border border-blue-200 shadow-sm bg-blue-50/30">
      <CardHeader className="pb-4 bg-blue-100/50">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-xs text-blue-600 mb-1">편집 모드</div>
            <CardTitle className="text-lg text-gray-900">견적 #{index + 1}</CardTitle>
          </div>
          <div className="flex items-center gap-3">
            {/* 수량 조절 */}
            <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-300 px-3 py-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuantityChange(editedItem.quantity - 1)}
                className="w-8 h-8 p-0 border-0 hover:bg-gray-100"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                type="number"
                value={editedItem.quantity}
                onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                className="w-16 text-center border-0 h-8 p-0 text-sm font-semibold"
                min="1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuantityChange(editedItem.quantity + 1)}
                className="w-8 h-8 p-0 border-0 hover:bg-gray-100"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEditInCalculator}
              className="text-green-600 border-green-300 hover:bg-green-50"
              title="계산기에서 수정"
            >
              <Calculator className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-blue-600 border-blue-300"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRemove(index)}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {/* 기본 옵션들 표시 (편집 가능) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="p-3 bg-white rounded-lg border border-gray-200">
            <Label className="text-xs text-gray-600 mb-1">소재</Label>
            <Input
              value={editedItem.material}
              onChange={(e) => handleFieldChange('material', e.target.value)}
              className="h-8 text-sm font-semibold"
            />
          </div>
          <div className="p-3 bg-white rounded-lg border border-gray-200">
            <Label className="text-xs text-gray-600 mb-1">재질</Label>
            <Input
              value={editedItem.quality}
              onChange={(e) => handleFieldChange('quality', e.target.value)}
              className="h-8 text-sm font-semibold"
            />
          </div>
          <div className="p-3 bg-white rounded-lg border border-gray-200">
            <Label className="text-xs text-gray-600 mb-1">두께</Label>
            <Input
              value={editedItem.thickness}
              onChange={(e) => handleFieldChange('thickness', e.target.value)}
              className="h-8 text-sm font-semibold"
            />
          </div>
          <div className="p-3 bg-white rounded-lg border border-gray-200">
            <Label className="text-xs text-gray-600 mb-1">사이즈</Label>
            <Input
              value={editedItem.size}
              onChange={(e) => handleFieldChange('size', e.target.value)}
              className="h-8 text-sm font-semibold"
            />
          </div>
          <div className="p-3 bg-white rounded-lg border border-gray-200">
            <Label className="text-xs text-gray-600 mb-1">면수</Label>
            <Input
              value={editedItem.surface}
              onChange={(e) => handleFieldChange('surface', e.target.value)}
              className="h-8 text-sm font-semibold"
            />
          </div>
          <div className="p-3 bg-white rounded-lg border border-gray-200 md:col-span-2">
            <Label className="text-xs text-gray-600 mb-1">가공방법</Label>
            <Input
              value={editedItem.processingName}
              onChange={(e) => handleFieldChange('processingName', e.target.value)}
              className="h-8 text-sm font-semibold"
            />
          </div>
          {editedItem.serialNumber !== undefined && (
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <Label className="text-xs text-yellow-700 mb-1">클라이언트 요청사항</Label>
              <Input
                value={editedItem.serialNumber || ''}
                onChange={(e) => handleFieldChange('serialNumber', e.target.value)}
                className="h-8 text-sm font-semibold bg-white"
              />
            </div>
          )}
        </div>

        {/* 색상 정보 */}
        {editedItem.selectedColor && (
          <div className="p-3 bg-white rounded-lg border border-gray-200 mb-4">
            <Label className="text-xs text-gray-600 mb-2 block">색상 정보</Label>
            <div className="flex items-center gap-2">
              {editedItem.selectedColorHex && (
                <div 
                  className="w-6 h-6 rounded border border-gray-300" 
                  style={{ backgroundColor: editedItem.selectedColorHex }}
                />
              )}
              <span className="text-sm font-semibold">{editedItem.selectedColor}</span>
              {editedItem.colorType === 'CUSTOM' && (
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">맞춤 색상</span>
              )}
            </div>
          </div>
        )}
        
        {/* 가격 상세 내역 (확장 시 표시) */}
        {isExpanded && editedItem.breakdown.length > 0 && (
          <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">가격 상세 내역 (단가)</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddBreakdown}
                className="text-green-600 border-green-300 hover:bg-green-50"
              >
                <Plus className="w-4 h-4 mr-1" />
                항목 추가
              </Button>
            </div>
            <div className="space-y-2">
              {editedItem.breakdown.map((breakdownItem, breakdownIndex) => (
                <div key={breakdownIndex} className="flex items-center gap-2 py-2 px-3 bg-gray-50 rounded">
                  <Input
                    value={breakdownItem.label}
                    onChange={(e) => handleBreakdownChange(breakdownIndex, 'label', e.target.value)}
                    className="flex-1 h-8 text-sm"
                    placeholder="항목명"
                  />
                  <Input
                    type="number"
                    value={breakdownItem.price}
                    onChange={(e) => handleBreakdownChange(breakdownIndex, 'price', e.target.value)}
                    className="w-32 h-8 text-sm text-right font-medium"
                    placeholder="금액"
                  />
                  <span className="text-sm text-gray-500">원</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveBreakdown(breakdownIndex)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 p-1 h-8 w-8"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 단가 직접 수정 (breakdown 없을 때) */}
        {!isExpanded && (
          <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
            <Label className="text-xs text-gray-600 mb-1">단가 직접 입력</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={editedItem.totalPrice}
                onChange={(e) => handleTotalPriceChange(Number(e.target.value))}
                className="w-40 h-8 text-sm font-semibold text-right"
              />
              <span className="text-sm text-gray-500">원</span>
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
            <span className="font-semibold text-gray-900">{editedItem.quantity}개</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <span className="text-gray-700 font-medium">소계</span>
            <span className="text-lg font-bold text-blue-600">{formatPrice(totalPrice)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EditableQuoteItem;
