import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Package, Scissors, Layers, Zap, Droplet, Settings, ChevronRight, CheckCircle2, Box, PaintBucket, Sparkles, Star, Circle, Square, Grid, Folder, FileText, type LucideIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useProcessingOptions, type ProcessingOption } from "@/hooks/useProcessingOptions";
import { useSlotTypes } from "@/hooks/useSlotTypes";
import { useCategoryLogic } from "@/hooks/useCategoryLogic";
import { useProcessingCategories } from "@/hooks/useProcessingCategories";
import { useAdvancedProcessingSettings } from "@/hooks/useAdvancedProcessingSettings";

interface ProcessingOptionsProps {
  selectedProcessing: string;
  selectedAdhesion: string;
  onProcessingSelect: (processingId: string, processingName?: string) => void;
  onAdhesionSelect: (adhesionId: string) => void;
  onSelectionCompleteChange?: (isComplete: boolean) => void;
  isGlossyStandard: boolean;
  selectedQualityId?: string;
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
  polishedEdgeLengthMm?: number;
  onPolishedEdgeLengthMmChange?: (length: number) => void;
  // 다중 선택된 옵션과 수량
  selectedAdditionalOptions?: Record<string, number>; // { option_id: quantity }
  onAdditionalOptionsChange?: (options: Record<string, number>) => void;
}

// 아이콘 매핑
const ICON_MAP: Record<string, LucideIcon> = {
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
  onSelectionCompleteChange,
  isGlossyStandard,
  selectedQualityId,
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
  polishedEdgeLengthMm = 0,
  onPolishedEdgeLengthMmChange,
  selectedAdditionalOptions = {},
  onAdditionalOptionsChange,
}) => {
  const [mainCategory, setMainCategory] = React.useState<string | null>(null);
  const [selectedSlots, setSelectedSlots] = React.useState<Record<string, string>>({});
  const [optionQuantities, setOptionQuantities] = React.useState<Record<string, number>>(selectedAdditionalOptions);
  const [hasRestoredSelection, setHasRestoredSelection] = React.useState(false);

  React.useEffect(() => {
    setOptionQuantities(selectedAdditionalOptions);
  }, [selectedAdditionalOptions]);
  
  const { processingOptions, activeAdditionalOptions, isLoading } = useProcessingOptions();
  const { slotTypes, isLoading: isLoadingSlots } = useSlotTypes();
  const { getCategorySlots: getCategoryLogicSlots, isLoading: isLoadingLogic } = useCategoryLogic();
  const { categories, isLoading: isLoadingCategories } = useProcessingCategories();
  const { getSettingValue } = useAdvancedProcessingSettings();
  const polishedEdgeRatePerM = getSettingValue('polished_edge_rate_per_m') || 14200;
  const isPolishedEdgeOption = (optionId: string) =>
    ['edgeFinishing', 'polishedEdge', 'polished-edge'].includes(optionId);

  // selectedProcessing에서 기존 선택값 복원
  React.useEffect(() => {
    if (hasRestoredSelection || !selectedProcessing || !processingOptions?.length || !categories?.length || isLoading || isLoadingCategories || isLoadingLogic) return;
    
    console.log('Attempting to restore processing selection:', selectedProcessing);
    
    const optionIds = selectedProcessing.includes('|') 
      ? selectedProcessing.split('|') 
      : [selectedProcessing];
    
    // 첫 번째 옵션 ID로 카테고리 찾기
    const firstOption = processingOptions.find(opt => opt.option_id === optionIds[0]);
    if (!firstOption) {
      console.log('Could not find option for:', optionIds[0]);
      return;
    }
    
    console.log('Found first option:', firstOption.option_id, 'type:', firstOption.option_type);
    
    // 해당 옵션이 속한 카테고리 찾기 (category_logic_slots에서)
    const activeCategories = categories.filter(c => c.is_active);
    let foundCategory: string | null = null;
    
    for (const cat of activeCategories) {
      const logicSlots = getCategoryLogicSlots(cat.category_key);
      const allowedSlotKeys = logicSlots.map(l => l.slot_key);
      
      if (allowedSlotKeys.includes(firstOption.option_type)) {
        foundCategory = cat.category_key;
        break;
      }
    }
    
    if (foundCategory) {
      setMainCategory(foundCategory);
      
      // 각 옵션 ID를 슬롯에 매핑
      const restoredSlots: Record<string, string> = {};
      optionIds.forEach(optId => {
        const opt = processingOptions.find(o => o.option_id === optId);
        if (opt) {
          restoredSlots[opt.option_type] = opt.option_id;
        }
      });
      
      setSelectedSlots(restoredSlots);
      setHasRestoredSelection(true);
      console.log('Restored processing selection:', { category: foundCategory, slots: restoredSlots });
    } else {
      console.log('Could not find category for option type:', firstOption.option_type);
    }
  }, [selectedProcessing, processingOptions, categories, isLoading, isLoadingCategories, isLoadingLogic, hasRestoredSelection, getCategoryLogicSlots]);

  const getCategorySlots = React.useCallback((category: string) => {
    if (!processingOptions) return {};
    
    // 해당 카테고리에 정의된 슬롯 키 가져오기
    const logicSlots = getCategoryLogicSlots(category);
    const allowedSlotKeys = logicSlots.map(logic => logic.slot_key);
    
  const slots: Record<string, ProcessingOption[]> = {};
  processingOptions
    .filter(opt => {
      if (['mirrorDeposition', 'mirror-deposition'].includes(opt.option_id)) return false;

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
  }, [getCategoryLogicSlots, processingOptions]);

  // 옵션이 선택된 두께에 적용 가능한지 확인
  const isOptionApplicable = (option: ProcessingOption): boolean => {
    if (['mirrorDeposition', 'mirror-deposition'].includes(option.option_id)) {
      return false;
    }

    if (['mirrorHardCoating', 'mirror-hard-coating'].includes(option.option_id)) {
      return /mirror/i.test(selectedQualityId || '');
    }

    if (!option.applicable_thicknesses || option.applicable_thicknesses.length === 0) {
      return true; // 두께 제한이 없으면 항상 적용 가능
    }
    return option.applicable_thicknesses.includes(selectedThickness);
  };

  // 메인 카테고리 선택
  const handleMainCategorySelect = (category: string) => {
    setMainCategory(category);
    setSelectedSlots({});
    setOptionQuantities({});
    onProcessingSelect('');
    onAdditionalOptionsChange?.({});
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
  const isSelectionComplete = React.useCallback((): boolean => {
    if (!mainCategory) return false;
    
    const slots = getCategorySlots(mainCategory);
    const logicSlots = getCategoryLogicSlots(mainCategory);
    const requiredSlots = logicSlots
      .filter(logic => logic.slot_key !== 'advanced_pricing' && logic.slot_key !== 'additional')
      .map(logic => logic.slot_key)
      .filter(key => slots[key] && slots[key].length > 0);
    
    const isComplete = requiredSlots.every(slot => {
      const slotTypeInfo = slotTypes?.find(st => st.slot_key === slot);
      if (slotTypeInfo?.allow_multiple_selection) {
        return slots[slot].some(option => (optionQuantities[option.option_id] || 0) > 0);
      }

      return Boolean(selectedSlots[slot]);
    });

    console.log('Selection complete check:', { requiredSlots, selectedSlots, optionQuantities, isComplete });
    return isComplete;
  }, [getCategoryLogicSlots, getCategorySlots, mainCategory, optionQuantities, selectedSlots, slotTypes]);

  React.useEffect(() => {
    if (isLoading || isLoadingSlots || isLoadingLogic || isLoadingCategories) {
      onSelectionCompleteChange?.(false);
      return;
    }

    onSelectionCompleteChange?.(isSelectionComplete());
  }, [
    mainCategory,
    optionQuantities,
    selectedSlots,
    selectedThickness,
    processingOptions,
    categories,
    isLoading,
    isLoadingSlots,
    isLoadingLogic,
    isLoadingCategories,
    isSelectionComplete,
    onSelectionCompleteChange,
  ]);

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
    <div className="space-y-7 animate-fade-in">
      <div className="text-center space-y-3">
        <h3 className="text-2xl font-semibold text-slate-950 sm:text-3xl">
          가공 방법을 선택해주세요
        </h3>
        <p className="text-muted-foreground text-base">
          단계별로 가공 옵션을 선택하세요
        </p>
      </div>

      {/* STEP 1: 메인 카테고리 선택 */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5 !text-slate-900" />
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
                  className={`p-4 rounded-lg border transition-colors text-left ${
                    mainCategory === category.category_key
                      ? 'border-slate-950 bg-slate-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-5 w-5 !text-slate-900" />
                    <span className="font-semibold text-sm">{category.category_name}</span>
                    {mainCategory === category.category_key && <CheckCircle2 className="ml-auto h-4 w-4 text-slate-950" />}
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
        
        // 모든 슬롯을 순서대로 렌더링
        const allSlotTypes = logicSlots
          .map(logic => logic.slot_key)
          .filter(slotKey => slots[slotKey] && slots[slotKey].length > 0);
        
        console.log('All slot types to render:', allSlotTypes);

        return allSlotTypes.map((slotType, stepIndex) => {
          const options = slots[slotType];
          // 슬롯 타입 정보 가져오기
          const slotTypeInfo = slotTypes?.find(st => st.slot_key === slotType);
          const slotLabel = slotTypeInfo?.title || slotType;
          const slotDescription = slotTypeInfo?.description;
          
          // 다중 선택 가능 여부 확인
          const allowMultiple = slotTypeInfo?.allow_multiple_selection || false;
          const showQuantity = slotTypeInfo?.show_quantity_control || false;
          
          // 다중 선택 모드인 경우
          if (allowMultiple) {
            return (
              <div key={slotType}>
                <Separator />
                <Card className="border-slate-200 bg-white shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Settings className="h-5 w-5 !text-slate-900" />
                      {slotLabel}
                      <Badge variant="outline" className="ml-auto">다중 선택</Badge>
                    </CardTitle>
                    {slotDescription && (
                      <p className="text-sm text-muted-foreground mt-2">{slotDescription}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {options
                        .filter(option => !['mirrorDeposition', 'mirror-deposition'].includes(option.option_id))
                        .filter(option => !['mirrorHardCoating', 'mirror-hard-coating'].includes(option.option_id) || /mirror/i.test(selectedQualityId || ''))
                        .map((option) => {
                        const isApplicable = isOptionApplicable(option);
                        const quantity = optionQuantities[option.option_id] || 0;
                        const isSelected = quantity > 0;
                        
                        return (
                          <div
                            key={option.id}
                            className={`p-4 rounded-lg border transition-colors ${
                              !isApplicable
                                ? 'bg-slate-50 border-slate-200 opacity-50'
                                : isSelected
                                ? 'border-slate-950 bg-slate-50 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-semibold">{option.name}</span>
                                  {!isApplicable && (
                                    <Badge variant="destructive" className="text-xs">
                                  {['mirrorHardCoating', 'mirror-hard-coating'].includes(option.option_id) ? '미러 전용' : `${selectedThickness} 불가`}
                                    </Badge>
                                  )}
                                  {isSelected && isApplicable && (
                                    <CheckCircle2 className="h-4 w-4 text-slate-950" />
                                  )}
                                </div>
                                {option.description && (
                                  <p className="text-xs text-muted-foreground mb-2">{option.description}</p>
                                )}
                                {option.base_cost && (
                                  <p className="text-xs font-semibold text-slate-900">
                                    +{option.base_cost.toLocaleString()}원
                                  </p>
                                )}
                                {['mirrorHardCoating', 'mirror-hard-coating'].includes(option.option_id) && (
                                  <p className="text-xs font-semibold text-slate-900">
                                    3*6 200,000원/장 · 4*8 300,000원/장
                                  </p>
                                )}
                              </div>
                              
                              {/* 수량 조절 UI */}
                              {isApplicable && showQuantity && option.allow_multiple && (
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
                                    onClick={() => {
                                      const maxQty = option.max_quantity;
                                      const newQty = quantity + 1;
                                      
                                      if (!maxQty || newQty <= maxQty) {
                                        const newQuantities = { ...optionQuantities, [option.option_id]: newQty };
                                        setOptionQuantities(newQuantities);
                                        onAdditionalOptionsChange?.(newQuantities);
                                      }
                                    }}
                                    disabled={option.max_quantity ? quantity >= option.max_quantity : false}
                                  >
                                    +
                                  </Button>
                                </div>
                              )}
                              
                              {/* 체크박스 UI (수량 없이 다중 선택만) */}
                              {isApplicable && !showQuantity && (
                                <Button
                                  variant={isSelected ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => {
                                    const newQuantities = { ...optionQuantities };
                                    if (isSelected) {
                                      delete newQuantities[option.option_id];
                                    } else {
                                      newQuantities[option.option_id] = 1;
                                    }
                                    setOptionQuantities(newQuantities);
                                    onAdditionalOptionsChange?.(newQuantities);
                                  }}
                                >
                                  {isSelected ? '선택됨' : '선택'}
                                </Button>
                              )}
                            </div>
                            {isApplicable && isSelected && isPolishedEdgeOption(option.option_id) && (
                              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <Label
                                  htmlFor={`polished-edge-length-${option.option_id}`}
                                  className="mb-2 flex items-center gap-2 text-sm font-semibold"
                                >
                                  경면 마감 길이 (mm)
                                  <Badge variant="outline" className="bg-background text-xs">
                                    {polishedEdgeRatePerM.toLocaleString()}원/m
                                  </Badge>
                                </Label>
                                <Input
                                  id={`polished-edge-length-${option.option_id}`}
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={polishedEdgeLengthMm || ''}
                                  onChange={(event) => onPolishedEdgeLengthMmChange?.(parseFloat(event.target.value) || 0)}
                                  placeholder="예: 2400"
                                  className="bg-background font-medium"
                                />
                                <p className="mt-2 text-xs text-muted-foreground">
                                  경면 마감 옵션에만 적용됩니다. 불광은 별도 검수 흐름을 유지합니다.
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          }
          
          // 단일 선택 모드인 경우
          return (
            <div key={slotType}>
              <Separator />
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ChevronRight className="h-5 w-5 !text-slate-900" />
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
                          className={`p-4 rounded-lg border transition-colors text-left ${
                            !isApplicable
                              ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-50'
                            : selectedSlots[slotType] === option.option_id
                              ? 'border-slate-950 bg-slate-50 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50'
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
                              <CheckCircle2 className="ml-auto h-4 w-4 text-slate-950" />
                            )}
                          </div>
                          {option.description && (
                            <p className="text-xs text-muted-foreground">{option.description}</p>
                          )}
                          {option.base_cost && (
                            <p className="mt-1 text-xs font-semibold text-slate-900">
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

      {mainCategory && !isSelectionComplete() && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          선택한 가공 카테고리의 세부 옵션을 모두 선택하면 견적에 반영됩니다.
        </div>
      )}

    </div>
  );
};

export default ProcessingOptions;
