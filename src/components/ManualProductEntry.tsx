import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, ArrowRight, Calculator, Box, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useManualProductOptions } from "@/hooks/useManualProductOptions";
import {
  calculateBubbleFreeBoxPricing,
  BubbleFreeBoxComplexity,
  BubbleFreeBoxJointAngle,
} from "@/utils/bubbleFreeBoxPricing";

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
  calculationBreakdown?: { label: string; price: number }[];
  pricingMeta?: Record<string, unknown>;
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
  const [boxForm, setBoxForm] = React.useState({
    itemNumber: '',
    name: '무기포 6면체 박스',
    quantity: 1,
    widthMm: 350,
    depthMm: 350,
    heightMm: 350,
    thickness: '5T',
    panelUnitPrice: 90000,
    manualSheetCount: 0,
    jointAngle: '45' as BubbleFreeBoxJointAngle,
    complexity: 'standard' as BubbleFreeBoxComplexity,
  });

  const boxEstimate = React.useMemo(() => (
    calculateBubbleFreeBoxPricing({
      widthMm: boxForm.widthMm,
      depthMm: boxForm.depthMm,
      heightMm: boxForm.heightMm,
      thicknessMm: parseFloat(boxForm.thickness.replace('T', '')),
      quantity: boxForm.quantity,
      panelUnitPrice: boxForm.panelUnitPrice,
      manualSheetCount: boxForm.manualSheetCount,
      jointAngle: boxForm.jointAngle,
      complexity: boxForm.complexity,
    })
  ), [boxForm]);

  const updateBoxForm = <K extends keyof typeof boxForm>(field: K, value: typeof boxForm[K]) => {
    setBoxForm(prev => ({ ...prev, [field]: value }));
  };

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

  const addBubbleFreeBoxItem = () => {
    if (!boxEstimate.feasible) return;

    const complexityLabel = {
      standard: '일반 6면체',
      polygon: '다각형/복합',
      precision: '정밀 마감',
    }[boxForm.complexity];

    const notes = [
      `${boxForm.widthMm}x${boxForm.depthMm}x${boxForm.heightMm}mm 6면체`,
      `${boxForm.thickness} / ${boxForm.jointAngle}도 무기포 접착`,
      `4*8 원판 ${boxEstimate.sheetCount}장 기준`,
      `제작 배수 ${boxEstimate.sizeMultiplier.toFixed(2)}, 접착 보정 x${boxEstimate.jointMultiplier.toFixed(2)}, 복잡도 x${boxEstimate.complexityMultiplier.toFixed(2)}`,
      boxEstimate.reviewRequired ? '관리자 확인 필요: 대형 박스 강성/마감 리스크' : '',
      ...boxEstimate.warnings,
    ].filter(Boolean).join('\n');

    const newItem: ManualProductItem = {
      id: Date.now().toString(),
      itemNumber: boxForm.itemNumber,
      name: boxForm.name,
      quantity: boxForm.quantity,
      unitPrice: boxEstimate.recommendedUnitPrice,
      sizeWidth: String(boxForm.widthMm),
      sizeHeight: String(boxForm.depthMm),
      sizeDepth: String(boxForm.heightMm),
      material: 'Clear (클리어)',
      thickness: boxForm.thickness,
      color: '투명/색상 별도 확인',
      colorHex: '',
      surfaceType: `${complexityLabel} / ${boxForm.jointAngle}도 무기포`,
      notes,
      calculationBreakdown: boxEstimate.breakdown,
      pricingMeta: {
        pricingType: 'bubble-free-box',
        automaticSheetCount: boxEstimate.automaticSheetCount,
        sheetCount: boxEstimate.sheetCount,
        materialCostTotal: boxEstimate.materialCostTotal,
        materialCostPerUnit: boxEstimate.materialCostPerUnit,
        sizeMultiplier: boxEstimate.sizeMultiplier,
        jointMultiplier: boxEstimate.jointMultiplier,
        complexityMultiplier: boxEstimate.complexityMultiplier,
        quantityFactor: boxEstimate.quantityFactor,
        minimumUnitPrice: boxEstimate.minimumUnitPrice,
        reviewRequired: boxEstimate.reviewRequired,
      },
    };

    onItemsChange([...items, newItem]);
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

      <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              <h4 className="text-lg font-semibold">무기포 6면체 박스 자동 산정</h4>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              4*8 원판 기준으로 사이즈, 수량, 접착각, 제작 난이도를 반영합니다.
            </p>
          </div>
          <Box className="w-5 h-5 text-primary/70 shrink-0" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-2">
            <Label>아이템 번호</Label>
            <Input
              value={boxForm.itemNumber}
              onChange={(e) => updateBoxForm('itemNumber', e.target.value)}
              placeholder="예: B001"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>제품명</Label>
            <Input
              value={boxForm.name}
              onChange={(e) => updateBoxForm('name', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>수량</Label>
            <Input
              type="number"
              min="1"
              value={boxForm.quantity}
              onChange={(e) => updateBoxForm('quantity', Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="space-y-2">
            <Label>가로 mm</Label>
            <Input
              type="number"
              min="0"
              value={boxForm.widthMm}
              onChange={(e) => updateBoxForm('widthMm', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label>세로 mm</Label>
            <Input
              type="number"
              min="0"
              value={boxForm.depthMm}
              onChange={(e) => updateBoxForm('depthMm', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label>높이 mm</Label>
            <Input
              type="number"
              min="0"
              value={boxForm.heightMm}
              onChange={(e) => updateBoxForm('heightMm', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label>두께</Label>
            <Select
              value={boxForm.thickness}
              onValueChange={(value) => updateBoxForm('thickness', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['3T', '4T', '5T', '6T', '8T', '10T', '12T'].map(thickness => (
                  <SelectItem key={thickness} value={thickness}>{thickness}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>4*8 원판 단가</Label>
            <Input
              type="number"
              min="0"
              step="1000"
              value={boxForm.panelUnitPrice}
              onChange={(e) => updateBoxForm('panelUnitPrice', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label>원판 장수</Label>
            <Input
              type="number"
              min="0"
              placeholder={`${boxEstimate.automaticSheetCount}장 자동`}
              value={boxForm.manualSheetCount || ''}
              onChange={(e) => updateBoxForm('manualSheetCount', parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>접착각</Label>
            <RadioGroup
              value={boxForm.jointAngle}
              onValueChange={(value) => updateBoxForm('jointAngle', value as BubbleFreeBoxJointAngle)}
              className="grid grid-cols-2 gap-2"
            >
              <Label className="flex items-center gap-2 rounded-md border bg-background p-3 cursor-pointer">
                <RadioGroupItem value="45" />
                45도 무기포
              </Label>
              <Label className="flex items-center gap-2 rounded-md border bg-background p-3 cursor-pointer">
                <RadioGroupItem value="90" />
                90도 무기포
              </Label>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label>제작 난이도</Label>
            <Select
              value={boxForm.complexity}
              onValueChange={(value) => updateBoxForm('complexity', value as BubbleFreeBoxComplexity)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">일반 6면체</SelectItem>
                <SelectItem value="polygon">다각형/복합</SelectItem>
                <SelectItem value="precision">정밀 마감 중요</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {boxEstimate.warnings.length > 0 && (
          <Alert variant={boxEstimate.feasible ? 'default' : 'destructive'}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{boxEstimate.feasible ? '확인 필요' : '제작 불가'}</AlertTitle>
            <AlertDescription>
              {boxEstimate.warnings.join(' ')}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-lg bg-background/80 p-3 border">
          <div>
            <div className="text-xs text-muted-foreground">권장 원판</div>
            <div className="text-lg font-semibold">{boxEstimate.sheetCount}장</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">제작 배수</div>
            <div className="text-lg font-semibold">x{boxEstimate.sizeMultiplier.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">개당 권장가</div>
            <div className="text-lg font-semibold text-primary">
              ₩{boxEstimate.recommendedUnitPrice.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">총 금액</div>
            <div className="text-lg font-semibold">
              ₩{boxEstimate.totalPrice.toLocaleString()}
            </div>
          </div>
        </div>

        <Button
          type="button"
          onClick={addBubbleFreeBoxItem}
          disabled={!boxEstimate.feasible || boxEstimate.recommendedUnitPrice <= 0}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          자동 산정 항목 추가
        </Button>
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
