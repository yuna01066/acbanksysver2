import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, ArrowRight } from "lucide-react";

export interface ManualProductItem {
  id: string;
  itemNumber: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface ManualProductEntryProps {
  items: ManualProductItem[];
  onItemsChange: (items: ManualProductItem[]) => void;
  onNext: () => void;
}

const ManualProductEntry: React.FC<ManualProductEntryProps> = ({
  items,
  onItemsChange,
  onNext
}) => {
  const addItem = () => {
    const newItem: ManualProductItem = {
      id: Date.now().toString(),
      itemNumber: '',
      name: '',
      quantity: 1,
      unitPrice: 0
    };
    onItemsChange([...items, newItem]);
  };

  const updateItem = (id: string, field: keyof ManualProductItem, value: string | number) => {
    onItemsChange(
      items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
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
        <p className="text-gray-600">개당 단가로 제품 정보를 입력해주세요</p>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => (
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
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                    onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
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
              
              <div className="mt-3 text-right text-sm text-muted-foreground">
                소계: <span className="font-semibold text-foreground">
                  ₩{(item.quantity * item.unitPrice).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}

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
