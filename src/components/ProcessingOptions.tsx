import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Scissors, Layers, Zap, Droplet, Settings, ChevronRight, CheckCircle2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useProcessingOptions } from "@/hooks/useProcessingOptions";
import { useSlotTypes } from "@/hooks/useSlotTypes";
import { useCategoryLogic } from "@/hooks/useCategoryLogic";

interface ProcessingOptionsProps {
  selectedProcessing: string;
  selectedAdhesion: string;
  onProcessingSelect: (processingId: string) => void;
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
}

type MainCategory = 'raw' | 'simple' | 'complex' | 'full' | 'adhesion';

const CATEGORY_INFO = {
  raw: { icon: Package, label: '원판 구매', description: '가공 없이 원판만 구매' },
  simple: { icon: Scissors, label: '단순 재단', description: '기본 재단 작업' },
  complex: { icon: Layers, label: '복합 재단', description: '복합적인 재단 작업' },
  full: { icon: Zap, label: '전체 재단', description: '복잡한 모양 전체 가공' },
  adhesion: { icon: Droplet, label: '접착 가공', description: '무기포/일반 접착' },
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
  onMugwangPaintingChange
}) => {
  const [mainCategory, setMainCategory] = React.useState<MainCategory | null>(null);
  const [selectedSlots, setSelectedSlots] = React.useState<Record<string, string>>({});
  
  const { processingOptions, activeAdditionalOptions, isLoading } = useProcessingOptions();
  const { slotTypes, isLoading: isLoadingSlots } = useSlotTypes();
  const { getCategorySlots: getCategoryLogicSlots, isLoading: isLoadingLogic } = useCategoryLogic();

  // 카테고리별 슬롯 옵션 가져오기
  const getCategorySlots = (category: MainCategory) => {
    if (!processingOptions) return {};
    
    const slots: Record<string, any[]> = {};
    processingOptions
      .filter(opt => opt.category === category && opt.is_active)
      .forEach(opt => {
        if (!slots[opt.option_type]) {
          slots[opt.option_type] = [];
        }
        slots[opt.option_type].push(opt);
      });
    
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
  const handleMainCategorySelect = (category: MainCategory) => {
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
    onProcessingSelect(selectedIds);
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

  if (isLoading || isLoadingSlots || isLoadingLogic) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="text-center">로딩 중...</div>
      </div>
    );
  }

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
            {(Object.keys(CATEGORY_INFO) as MainCategory[]).map((category) => {
              const { icon: Icon, label, description } = CATEGORY_INFO[category];
              return (
                <button
                  key={category}
                  onClick={() => handleMainCategorySelect(category)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    mainCategory === category
                      ? 'bg-primary/10 border-primary shadow-md'
                      : 'bg-background border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-sm">{label}</span>
                    {mainCategory === category && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{description}</p>
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
        
        // 로직에 정의된 순서대로 슬롯 정렬, advanced_pricing과 additional 제외
        const mainSlotTypes = logicSlots
          .filter(logic => logic.slot_key !== 'advanced_pricing' && logic.slot_key !== 'additional')
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
      {mainCategory && isSelectionComplete() && (() => {
        const logicSlots = getCategoryLogicSlots(mainCategory);
        const slots = getCategorySlots(mainCategory);
        
        // 고급 가격 설정과 추가 옵션 슬롯만 필터링
        const additionalSlotTypes = logicSlots
          .filter(logic => logic.slot_key === 'advanced_pricing' || logic.slot_key === 'additional')
          .filter(logic => slots[logic.slot_key] && slots[logic.slot_key].length > 0);
        
        return additionalSlotTypes.length > 0;
      })() && (() => {
        const logicSlots = getCategoryLogicSlots(mainCategory);
        const slots = getCategorySlots(mainCategory);
        
        const additionalSlotTypes = logicSlots
          .filter(logic => logic.slot_key === 'advanced_pricing' || logic.slot_key === 'additional')
          .filter(logic => slots[logic.slot_key] && slots[logic.slot_key].length > 0);
        
        return additionalSlotTypes.map((logicSlot, idx) => {
          const slotType = logicSlot.slot_key;
          const options = slots[slotType];
          const slotTypeInfo = slotTypes?.find(st => st.slot_key === slotType);
          const slotLabel = slotTypeInfo?.title || (slotType === 'additional' ? '추가 옵션' : slotType === 'advanced_pricing' ? '고급 가격 설정' : `선택 ${slotType}`);
          const slotDescription = slotTypeInfo?.description;
          
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

      {/* 수량 입력 (단순 재단) */}
      {mainCategory === 'simple' && isSelectionComplete() && (
        <>
          <Separator />
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="w-5 h-5 text-primary" />
                수량 선택
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="qty">제작 수량 (EA)</Label>
              <Input
                id="qty"
                type="number"
                min="1"
                value={qty}
                onChange={(e) => onQtyChange?.(parseInt(e.target.value) || 1)}
                className="mt-2"
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ProcessingOptions;
