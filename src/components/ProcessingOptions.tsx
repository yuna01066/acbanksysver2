import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Package, Scissors, Layers, Zap, Droplet, Settings, ChevronRight, CheckCircle2, Box, PaintBucket, Sparkles, Star, Circle, Square, Grid, Folder, FileText } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useProcessingOptions } from "@/hooks/useProcessingOptions";
import { useSlotTypes } from "@/hooks/useSlotTypes";
import { useCategoryLogic } from "@/hooks/useCategoryLogic";
import { useProcessingCategories } from "@/hooks/useProcessingCategories";

interface ProcessingOptionsProps {
  selectedProcessing: string;
  selectedAdhesion: string;
  onProcessingSelect: (processingId: string, processingName?: string) => void;
  onAdhesionSelect: (adhesionId: string) => void;
  isGlossyStandard: boolean;
  selectedThickness: string;
  qty?: number;
  onQtyChange?: (qty: number) => void;
  isComplex?: boolean;
  onComplexChange?: (isComplex: boolean) => void;
  edgeFinishing?: boolean;
  onEdgeFinishingChange?: (value: boolean) => void;
  bulgwang?: boolean;
  onBulgwangChange?: (value: boolean) => void;
  tapung?: boolean;
  onTapungChange?: (value: boolean) => void;
  mugwangPainting?: boolean;
  onMugwangPaintingChange?: (value: boolean) => void;
  // 다중 선택된 옵션과 수량
  selectedAdditionalOptions?: Record<string, number>; // { option_id: quantity }
  onAdditionalOptionsChange?: (options: Record<string, number>) => void;
}

// 아이콘 매핑
const ICON_MAP: Record<string, any> = {
  Package,
  Scissors,
  Layers,
  Zap,
  Droplet,
  Settings,
  Box,
  PaintBucket,
  Sparkles,
  Star,
  Circle,
  Square,
  Grid,
  Folder,
  FileText,
};

const ProcessingOptions: React.FC<ProcessingOptionsProps> = ({
  selectedProcessing,
  onProcessingSelect,
  isGlossyStandard,
  selectedThickness,
  qty = 1,
  onQtyChange,
  edgeFinishing,
  onEdgeFinishingChange,
  bulgwang,
  onBulgwangChange,
  tapung,
  onTapungChange,
  mugwangPainting,
  onMugwangPaintingChange,
  selectedAdditionalOptions = {},
  onAdditionalOptionsChange,
}) => {
  const [mainCategory, setMainCategory] = React.useState<string | null>(null);
  const [selectedSlots, setSelectedSlots] = React.useState<Record<string, string>>({});
  const [optionQuantities, setOptionQuantities] = React.useState<Record<string, number>>(selectedAdditionalOptions);
  
  const { processingOptions, activeAdditionalOptions, isLoading } = useProcessingOptions();
  const { slotTypes, isLoading: isLoadingSlots } = useSlotTypes();
  const { getCategorySlots: getCategoryLogicSlots, isLoading: isLoadingLogic } = useCategoryLogic();
  const { categories, isLoading: isLoadingCategories } = useProcessingCategories();

  // 카테고리별 슬롯 옵션 가져오기
  const getCategorySlots = (category: string) => {
    if (!processingOptions) return {};
    
    // 해당 카테고리에 정의된 슬롯 키 가져오기
    const logicSlots = getCategoryLogicSlots(category);
    const allowedSlotKeys = logicSlots.map(logic => logic.slot_key);
    
  const slots: Record<string, any[]> = {};
  processingOptions
    .filter(opt => {
      // option_type이 허용된 슬롯 키에 포함되어야 함
      if (!allowedSlotKeys.includes(opt.option_type)) return false;
      
      // additional과 advanced_pricing 타입은 항상 포함
      if (opt.option_type === 'additional' || opt.option_type === 'advanced_pricing') return opt.is_active;
      
      // 나머지는 활성화 상태만 체크 (category_logic에 정의되어 있으면 category와 무관하게 표시)
      return opt.is_active;
    })
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0)) // display_order로 정렬
    .forEach(opt => {
      if (!slots[opt.option_type]) {
        slots[opt.option_type] = [];
      }
      slots[opt.option_type].push(opt);
    });
    
    console.log('getCategorySlots result:', { category, allowedSlotKeys, slots });
    return slots;
  };

  // 옵션이 선택된 두께에 적용 가능한지 확인
  const isOptionApplicable = (option: any): boolean => {
    if (!option.applicable_thicknesses || option.applicable_thicknesses.length === 0) {
      return true; // 두께 제한이 없으면 항상 적용 가능
    }
    return option.applicable_thicknesses.includes(selectedThickness);
  };

  // 메인 카테고리 선택
  const handleMainCategorySelect = (category: string) => {
    setMainCategory(category);
    setSelectedSlots({});
    onProcessingSelect('');
  };

  // 슬롯 선택
  const handleSlotSelect = (slotType: string, optionId: string) => {
    const newSlots = { ...selectedSlots, [slotType]: optionId };
    setSelectedSlots(newSlots);
    
    // 선택된 모든 옵션 ID를 조합하여 processingId 생성
    const selectedIds = Object.values(newSlots).join('|');
    
    // 선택된 옵션들의 이름도 조합
    const selectedNames = Object.entries(newSlots).map(([key, value]) => {
      const option = processingOptions?.find(opt => opt.option_id === value);
      return option?.name || '';
    }).filter(Boolean).join(' + ');
    
    onProcessingSelect(selectedIds, selectedNames);
  };

  // 선택 완료 여부 확인 (메인 슬롯만, advanced_pricing과 additional 제외)
  const isSelectionComplete = (): boolean => {
    if (!mainCategory) return false;
    
    const slots = getCategorySlots(mainCategory);
    const logicSlots = getCategoryLogicSlots(mainCategory);
    const requiredSlots = logicSlots
      .filter(logic => logic.slot_key !== 'advanced_pricing' && logic.slot_key !== 'additional')
      .map(logic => logic.slot_key)
      .filter(key => slots[key] && slots[key].length > 0);
    
    const isComplete = requiredSlots.every(slot => selectedSlots[slot]);
    console.log('Selection complete check:', { requiredSlots, selectedSlots, isComplete });
    return isComplete;
  };

  if (isLoading || isLoadingSlots || isLoadingLogic || isLoadingCategories) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="text-center">로딩 중...</div>
      </div>
    );
  }

  // 활성화된 카테고리만 필터링
  const activeCategories = categories?.filter(c => c.is_active) || [];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center space-y-3">
        <h3 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          가공 방법을 선택해주세요
        </h3>
        <p className="text-muted-foreground text-lg">
          단계별로 가공 옵션을 선택하세요
        </p>
      </div>

      {/* STEP 1: 메인 카테고리 선택 */}
      <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="w-5 h-5 text-primary" />
            가공 카테고리 선택
            <Badge variant="secondary" className="ml-auto">STEP 1</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {activeCategories.map((category) => {
              const Icon = ICON_MAP[category.icon_name] || Package;
              return (
                <button
                  key={category.id}
                  onClick={() => handleMainCategorySelect(category.category_key)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    mainCategory === category.category_key
                      ? 'bg-primary/10 border-primary shadow-md'
                      : 'bg-background border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-sm">{category.category_name}</span>
                    {mainCategory === category.category_key && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 동적 슬롯 렌더링 */}
      {mainCategory && (() => {
        const slots = getCategorySlots(mainCategory);
        
        // 관리자 설정에서 정의한 슬롯 로직 가져오기
        const logicSlots = getCategoryLogicSlots(mainCategory);
        
        console.log('Current category:', mainCategory);
        console.log('Logic slots:', logicSlots);
        console.log('Available slots:', slots);
        
        // 로직에 정의된 순서대로 슬롯 정렬
        // slot1~6만 메인 슬롯으로 처리 (단일 선택)
        // slot7 이상, advanced_pricing, additional은 추가 옵션으로 처리 (다중 선택)
        const mainSlotTypes = logicSlots
          .filter(logic => {
            const slotKey = logic.slot_key;
            // slot1~6만 메인 슬롯
            return slotKey.match(/^slot[1-6]$/);
          })
          .map(logic => logic.slot_key)
          .filter(slotKey => slots[slotKey] && slots[slotKey].length > 0);
        
        console.log('Main slot types to render:', mainSlotTypes);

        return mainSlotTypes.map((slotType, stepIndex) => {
          const options = slots[slotType];
          // 슬롯 타입 정보에서 title을 가져오거나, 없으면 기본값 사용
          const slotTypeInfo = slotTypes?.find(st => st.slot_key === slotType);
          const slotLabel = slotTypeInfo?.title || slotType;
          const slotDescription = slotTypeInfo?.description;
          
          return (
            <div key={slotType}>
              <Separator />
              <Card className="border-2 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ChevronRight className="w-5 h-5 text-primary" />
                    {slotLabel}
                    <Badge variant="secondary" className="ml-auto">STEP {stepIndex + 2}</Badge>
                  </CardTitle>
                  {slotDescription && (
                    <p className="text-sm text-muted-foreground mt-2">{slotDescription}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {options.map((option) => {
                      const isApplicable = isOptionApplicable(option);
                      return (
                        <button
                          key={option.id}
                          onClick={() => isApplicable && handleSlotSelect(slotType, option.option_id)}
                          disabled={!isApplicable}
                          className={`p-4 rounded-lg border-2 transition-all text-left ${
                            !isApplicable
                              ? 'bg-muted/50 border-muted cursor-not-allowed opacity-50'
                              : selectedSlots[slotType] === option.option_id
                              ? 'bg-primary/10 border-primary shadow-md'
                              : 'bg-background border-border hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold">{option.name}</span>
                            {!isApplicable && (
                              <Badge variant="destructive" className="text-xs">
                                {selectedThickness} 불가
                              </Badge>
                            )}
                            {selectedSlots[slotType] === option.option_id && isApplicable && (
                              <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />
                            )}
                          </div>
                          {option.description && (
                            <p className="text-xs text-muted-foreground">{option.description}</p>
                          )}
                          {option.base_cost && (
                            <p className="text-xs text-primary font-semibold mt-1">
                              +{option.base_cost.toLocaleString()}원
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        });
      })()}

      {/* 고급 가격 설정 및 추가 옵션 동적 렌더링 */}
      {mainCategory && (() => {
        const isComplete = isSelectionComplete();
        const logicSlots = getCategoryLogicSlots(mainCategory);
        const slots = getCategorySlots(mainCategory);
        
        console.log('Additional slots check:', {
          mainCategory,
          isComplete,
          logicSlots,
          slots
        });
        
        // slot7 이상, 고급 가격 설정, 추가 옵션 슬롯 필터링 (다중 선택 가능)
        const additionalSlotTypes = logicSlots
          .filter(logic => {
            const slotKey = logic.slot_key;
            // slot7 이상, advanced_pricing, additional은 추가 옵션
            return slotKey === 'advanced_pricing' || 
                   slotKey === 'additional' || 
                   slotKey.match(/^slot([7-9]|[1-9]\d+)$/);
          })
          .filter(logic => slots[logic.slot_key] && slots[logic.slot_key].length > 0);
        
        console.log('Additional slot types:', additionalSlotTypes);
        
        if (!isComplete || additionalSlotTypes.length === 0) {
          console.log('Not showing additional slots:', { isComplete, additionalSlotsCount: additionalSlotTypes.length });
          return null;
        }
        
        return additionalSlotTypes.map((logicSlot, idx) => {
          const slotType = logicSlot.slot_key;
          const options = slots[slotType];
          const slotTypeInfo = slotTypes?.find(st => st.slot_key === slotType);
          const slotLabel = slotTypeInfo?.title || (slotType === 'additional' ? '추가 옵션' : slotType === 'advanced_pricing' ? '고급 가격 설정' : `선택 ${slotType}`);
          const slotDescription = slotTypeInfo?.description;
          
          console.log('Rendering additional slot:', { slotType, slotLabel, optionsCount: options.length });
          
          // 다중 선택 가능한지 확인
          const hasMultipleOptions = options.some(opt => opt.allow_multiple);
          
          return (
            <div key={slotType}>
              <Separator />
              <Card className="border-2 border-accent/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Settings className="w-5 h-5 text-accent" />
                    {slotLabel}
                    <Badge variant="outline" className="ml-auto">선택사항</Badge>
                  </CardTitle>
                  {slotDescription && (
                    <p className="text-sm text-muted-foreground mt-2">{slotDescription}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {options.map((option) => {
                      const isApplicable = isOptionApplicable(option);
                      const isSelected = optionQuantities[option.option_id] > 0;
                      const quantity = optionQuantities[option.option_id] || 0;
                      
                      return (
                        <div
                          key={option.id}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            !isApplicable
                              ? 'bg-muted/50 border-muted opacity-50'
                              : isSelected
                              ? 'bg-primary/10 border-primary shadow-sm'
                              : 'bg-background border-border hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold">{option.name}</span>
                                {!isApplicable && (
                                  <Badge variant="destructive" className="text-xs">
                                    {selectedThickness} 불가
                                  </Badge>
                                )}
                                {isSelected && isApplicable && (
                                  <CheckCircle2 className="w-4 h-4 text-primary" />
                                )}
                              </div>
                              {option.description && (
                                <p className="text-xs text-muted-foreground mb-2">{option.description}</p>
                              )}
                              {option.base_cost && (
                                <p className="text-xs text-primary font-semibold">
                                  +{option.base_cost.toLocaleString()}원
                                </p>
                              )}
                            </div>
                            
                            {/* 수량 조절 UI */}
                            {isApplicable && option.allow_multiple && (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  disabled={quantity <= 0}
                                  onClick={() => {
                                    const minQty = option.min_quantity ?? 0;
                                    const newQty = Math.max(minQty, quantity - 1);
                                    const newQuantities = { ...optionQuantities };
                                    
                                    if (newQty === 0) {
                                      delete newQuantities[option.option_id];
                                    } else {
                                      newQuantities[option.option_id] = newQty;
                                    }
                                    
                                    setOptionQuantities(newQuantities);
                                    onAdditionalOptionsChange?.(newQuantities);
                                  }}
                                >
                                  -
                                </Button>
                                <Input
                                  type="number"
                                  min={option.min_quantity ?? 0}
                                  max={option.max_quantity}
                                  value={quantity}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    const minQty = option.min_quantity ?? 0;
                                    const maxQty = option.max_quantity;
                                    let newQty = Math.max(minQty, val);
                                    if (maxQty) newQty = Math.min(newQty, maxQty);
                                    
                                    const newQuantities = { ...optionQuantities };
                                    if (newQty === 0) {
                                      delete newQuantities[option.option_id];
                                    } else {
                                      newQuantities[option.option_id] = newQty;
                                    }
                                    
                                    setOptionQuantities(newQuantities);
                                    onAdditionalOptionsChange?.(newQuantities);
                                  }}
                                  className="w-16 text-center h-8"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  disabled={option.max_quantity !== undefined && option.max_quantity !== null && quantity >= option.max_quantity}
                                  onClick={() => {
                                    const maxQty = option.max_quantity;
                                    const newQty = quantity + 1;
                                    
                                    if (maxQty === undefined || maxQty === null || newQty <= maxQty) {
                                      const newQuantities = { ...optionQuantities, [option.option_id]: newQty };
                                      setOptionQuantities(newQuantities);
                                      onAdditionalOptionsChange?.(newQuantities);
                                    }
                                  }}
                                >
                                  +
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        });
      })()}
    </div>
  );
};

export default ProcessingOptions;
