import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, ArrowRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createQuoteItemId } from "@/utils/quoteItemIdentity";

export interface ManualProductItem {
  id: string;
  itemNumber: string;
  name: string;
  quantity: number;
  unitPrice: number;
  sizeWidth: string;
  sizeHeight: string;
  sizeDepth: string;
  material: string;
  thickness: string;
  color: string;
  colorHex: string;
  surfaceType: string;
  productType?: string;
  bondingMethod?: string;
  notes: string;
  calculationBreakdown?: { label: string; price: number }[];
  pricingMeta?: Record<string, unknown>;
}

interface ManualProductEntryProps {
  items: ManualProductItem[];
  onItemsChange: (items: ManualProductItem[]) => void;
  onNext: () => void;
}

const PRODUCT_TYPE_OPTIONS = ['박스', '테이블/집기', '다각형/특수', '기타'];
const BONDING_METHOD_OPTIONS = ['45도 무기포', '90도 무기포', '일반 접착', '접착 없음/별도'];

const createEmptyItem = (): ManualProductItem => ({
  id: createQuoteItemId(),
  itemNumber: '',
  name: '',
  quantity: 1,
  unitPrice: 0,
  sizeWidth: '',
  sizeHeight: '',
  sizeDepth: '',
  material: '',
  thickness: '',
  color: '',
  colorHex: '',
  surfaceType: '',
  productType: '',
  bondingMethod: '',
  notes: '',
});

const ManualProductEntry: React.FC<ManualProductEntryProps> = ({
  items,
  onItemsChange,
  onNext
}) => {
  const addItem = () => {
    onItemsChange([...items, createEmptyItem()]);
  };

  const updateItem = (id: string, field: keyof ManualProductItem, value: string | number) => {
    onItemsChange(
      items.map(item => {
        if (item.id !== id) return item;
        return {
          ...item,
          [field]: value,
          calculationBreakdown: undefined,
          pricingMeta: {
            ...(item.pricingMeta || {}),
            pricingType: 'manual-fabrication-unit-price',
          },
        };
      })
    );
  };

  const removeItem = (id: string) => {
    onItemsChange(items.filter(item => item.id !== id));
  };

  const getTotalPrice = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const isValid = items.length > 0 && items.every(item => 
    item.name.trim() !== '' && item.quantity > 0 && item.unitPrice > 0
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">제품 제작 견적</h3>
        <p className="text-gray-600">수동 개당 단가 기준</p>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => {
          return (
            <Card key={item.id} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    항목 {index + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* 기본 정보 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label htmlFor={`itemNumber-${item.id}`}>아이템 번호</Label>
                    <Input
                      id={`itemNumber-${item.id}`}
                      value={item.itemNumber}
                      onChange={(e) => updateItem(item.id, 'itemNumber', e.target.value)}
                      placeholder="예: P001"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`name-${item.id}`}>제품명 *</Label>
                    <Input
                      id={`name-${item.id}`}
                      value={item.name}
                      onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                      placeholder="제품명 입력"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`quantity-${item.id}`}>수량 *</Label>
                    <Input
                      id={`quantity-${item.id}`}
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`unitPrice-${item.id}`}>단가 (원) *</Label>
                    <Input
                      id={`unitPrice-${item.id}`}
                      type="number"
                      min="0"
                      step="100"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(item.id, 'unitPrice', parseInt(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label>제작 유형</Label>
                    <Select
                      value={item.productType || ''}
                      onValueChange={(val) => updateItem(item.id, 'productType', val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="유형 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRODUCT_TYPE_OPTIONS.map(option => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>접착 방식</Label>
                    <Select
                      value={item.bondingMethod || ''}
                      onValueChange={(val) => updateItem(item.id, 'bondingMethod', val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="접착 방식 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {BONDING_METHOD_OPTIONS.map(option => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mb-4">
                  <Label className="mb-2 block">규격 (가로 × 세로 × 높이)</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      value={item.sizeWidth}
                      onChange={(e) => updateItem(item.id, 'sizeWidth', e.target.value)}
                      placeholder="가로"
                    />
                    <Input
                      value={item.sizeHeight}
                      onChange={(e) => updateItem(item.id, 'sizeHeight', e.target.value)}
                      placeholder="세로"
                    />
                    <Input
                      value={item.sizeDepth}
                      onChange={(e) => updateItem(item.id, 'sizeDepth', e.target.value)}
                      placeholder="높이"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label htmlFor={`material-${item.id}`}>소재</Label>
                    <Input
                      id={`material-${item.id}`}
                      value={item.material}
                      onChange={(e) => updateItem(item.id, 'material', e.target.value)}
                      placeholder="예: Clear, 사틴, 미러"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`thickness-${item.id}`}>두께</Label>
                    <Input
                      id={`thickness-${item.id}`}
                      value={item.thickness}
                      onChange={(e) => updateItem(item.id, 'thickness', e.target.value)}
                      placeholder="예: 5T"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`color-${item.id}`}>색상</Label>
                    <Input
                      id={`color-${item.id}`}
                      value={item.color}
                      onChange={(e) => updateItem(item.id, 'color', e.target.value)}
                      placeholder="예: 투명, 백색, 조색"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`notes-${item.id}`}>메모</Label>
                  <Textarea
                    id={`notes-${item.id}`}
                    value={item.notes}
                    onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                    placeholder="작업 내용, 난이도, 특이사항"
                    rows={2}
                  />
                </div>
                
                <div className="mt-3 text-right text-sm text-muted-foreground">
                  소계: <span className="font-semibold text-foreground">
                    ₩{(item.quantity * item.unitPrice).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Button
          variant="outline"
          onClick={addItem}
          className="w-full h-14 border-dashed"
        >
          <Plus className="w-4 h-4 mr-2" />
          항목 추가
        </Button>
      </div>

      {items.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">총 금액</span>
            <span className="text-2xl font-bold text-primary">
              ₩{getTotalPrice().toLocaleString()}
            </span>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            부가세 별도 (VAT 10% 별도)
          </div>
        </div>
      )}

      <Button
        onClick={onNext}
        disabled={!isValid}
        className="w-full h-14 text-lg font-semibold"
      >
        다음 단계로
        <ArrowRight className="w-5 h-5 ml-2" />
      </Button>
    </div>
  );
};

export default ManualProductEntry;
