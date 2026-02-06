import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, ArrowRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useManualProductOptions } from "@/hooks/useManualProductOptions";

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
  notes: string;
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
  const { materials, thicknessMap, colorMap } = useManualProductOptions();

  const addItem = () => {
    const newItem: ManualProductItem = {
      id: Date.now().toString(),
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
      notes: ''
    };
    onItemsChange([...items, newItem]);
  };

  const updateItem = (id: string, field: keyof ManualProductItem, value: string | number) => {
    onItemsChange(
      items.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        // Cascading reset
        if (field === 'material') {
          updated.thickness = '';
          updated.color = '';
          updated.colorHex = '';
        } else if (field === 'thickness') {
          updated.color = '';
          updated.colorHex = '';
        }
        return updated;
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

  const getMaterialId = (materialName: string) => {
    return materials.find(m => m.name === materialName)?.id || '';
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">제품 제작 견적</h3>
        <p className="text-gray-600">개당 단가로 제품 정보를 입력해주세요</p>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => {
          const materialId = getMaterialId(item.material);
          const availableThicknesses = materialId ? (thicknessMap[materialId] || []) : [];
          const availableColors = materialId ? (colorMap[materialId] || []) : [] as { name: string; code: string | null }[];

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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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

                {/* 사이즈 입력 */}
                <div className="mb-4">
                  <Label className="mb-2 block">사이즈 (가로 × 세로 × 높이)</Label>
                  <div className="grid grid-cols-3 gap-2">
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

                {/* 재질, 두께, 색상, 면수 - 캐스케이딩 드롭다운 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label>재질</Label>
                    <Select
                      value={item.material}
                      onValueChange={(val) => updateItem(item.id, 'material', val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="재질 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {materials.map((m) => (
                          <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>두께</Label>
                    <Select
                      value={item.thickness}
                      onValueChange={(val) => updateItem(item.id, 'thickness', val)}
                      disabled={!item.material}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={item.material ? "두께 선택" : "재질을 먼저 선택"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableThicknesses.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>색상</Label>
                    <Select
                      value={item.color}
                      onValueChange={(val) => {
                        const colorObj = availableColors.find(c => c.name === val);
                        updateItem(item.id, 'color', val);
                        if (colorObj?.code) {
                          // Set colorHex after color update
                          onItemsChange(items.map(it => it.id === item.id ? { ...it, color: val, colorHex: colorObj.code || '' } : it));
                        }
                      }}
                      disabled={!item.thickness}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={item.thickness ? "컬러 선택" : "두께를 먼저 선택"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableColors.map((c) => (
                          <SelectItem key={c.name} value={c.name}>
                            <span className="flex items-center gap-2">
                              {c.code && (
                                <span
                                  className="inline-block w-4 h-4 rounded-sm border border-border shrink-0"
                                  style={{ backgroundColor: c.code }}
                                />
                              )}
                              {c.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>면수</Label>
                    <Select
                      value={item.surfaceType}
                      onValueChange={(val) => updateItem(item.id, 'surfaceType', val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="면수 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="단면">단면</SelectItem>
                        <SelectItem value="양면">양면</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 기타사항 */}
                <div className="space-y-2">
                  <Label htmlFor={`notes-${item.id}`}>기타사항</Label>
                  <Textarea
                    id={`notes-${item.id}`}
                    value={item.notes}
                    onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                    placeholder="추가 요청사항이나 특이사항을 입력하세요"
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
