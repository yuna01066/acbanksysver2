import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Package, Scissors, Cpu, Droplet, Sparkles, CheckCircle2, Settings } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface ProcessingOption {
  id: string;
  name: string;
  description: string;
  category: 'raw' | 'processing' | 'adhesion';
}

const PROCESSING_OPTIONS: ProcessingOption[] = [
  { 
    id: 'raw-only', 
    name: '원판 단독 구매', 
    description: '가공 없이 원판만 구매 (자재비에만 ×1.3 적용)', 
    category: 'raw' 
  },
  { 
    id: 'none', 
    name: '가공 없음', 
    description: '자재비에만 기본 문의 배수 적용 (×1.2)', 
    category: 'raw' 
  },
  { 
    id: 'auto', 
    name: '자동 선택 (권장)', 
    description: '두께와 복잡도에 따라 최적 가공 방식 자동 선택 (10T 미만: 레이저, 10T 이상: CNC)', 
    category: 'processing' 
  },
  { 
    id: 'simple-cutting', 
    name: '단순 재단', 
    description: '기본 직선 재단 (10T 미만: 자재비 증분 +20%, 10T 이상: +80%)', 
    category: 'processing' 
  },
  { 
    id: 'edge-finishing', 
    name: '엣지 격면 마감', 
    description: '엣지 연마 및 격면 마감 처리 (10T 이하: 자재비 증분 +80%, 10T 초과: +100%)', 
    category: 'processing' 
  },
  { 
    id: 'laser-simple', 
    name: '레이저 단순 가공', 
    description: '10T 미만 적합, 단순 모양 레이저 커팅 (배수 1.7 × 두께계수)', 
    category: 'processing' 
  },
  { 
    id: 'laser-complex', 
    name: '레이저 복합 가공', 
    description: '10T 미만 적합, 복잡한 모양 레이저 커팅 (배수 2.0 × 두께계수)', 
    category: 'processing' 
  },
  { 
    id: 'cnc-simple', 
    name: 'CNC 단순 가공', 
    description: '10T 이상 적합, 단순 CNC 가공 (배수 1.8 × 두께계수)', 
    category: 'processing' 
  },
  { 
    id: 'cnc-complex', 
    name: 'CNC 복합 가공', 
    description: '10T 이상 적합, 복잡한 CNC 가공 (배수 2.5 × 두께계수)', 
    category: 'processing' 
  },
  { 
    id: 'bond-normal', 
    name: '일반 접착', 
    description: '기본 접착 작업 (자재비 증분 +100%)', 
    category: 'adhesion' 
  },
  { 
    id: 'bond-mugipo-auto', 
    name: '무기포 접착 (자동)', 
    description: '45°와 90° 중 더 저렴한 방식 자동 선택 (얕은 트레이는 45° 우대)', 
    category: 'adhesion' 
  },
  { 
    id: 'bond-mugipo-45', 
    name: '무기포 접착 45°', 
    description: '45° 무기포 접착, 레이저/엣지 포함 (10T 미만: 배수 2.2, 10T 이상: 2.3)', 
    category: 'adhesion' 
  },
  { 
    id: 'bond-mugipo-90', 
    name: '무기포 접착 90°', 
    description: '90° 무기포 접착, 레이저/엣지 포함 + 인건비 프리미엄 (배수 2.3 × 1.12)', 
    category: 'adhesion' 
  }
];

interface ProcessingOptionsProps {
  selectedProcessing: string;
  selectedAdhesion: string;
  onProcessingSelect: (processingId: string) => void;
  onAdhesionSelect: (adhesionId: string) => void;
  isGlossyStandard: boolean;
  // 수량 및 복잡도 관련 props 추가
  qty?: number;
  onQtyChange?: (qty: number) => void;
  isComplex?: boolean;
  onComplexChange?: (isComplex: boolean) => void;
}

const ProcessingOptions: React.FC<ProcessingOptionsProps> = ({
  selectedProcessing,
  selectedAdhesion,
  onProcessingSelect,
  onAdhesionSelect,
  isGlossyStandard,
  qty = 1,
  onQtyChange,
  isComplex = false,
  onComplexChange
}) => {
  // 상단 카테고리 선택에 따라 표시할 카테고리 결정
  const [selectedCategory, setSelectedCategory] = React.useState<'raw' | 'processing' | 'complex' | 'adhesion' | null>(null);

  const getCategoryIcon = (categoryId: string) => {
    switch (categoryId) {
      case 'raw': return Package;
      case 'processing': return Scissors;
      case 'adhesion': return Droplet;
      default: return Sparkles;
    }
  };

  const allCategories = [
    { 
      id: 'raw', 
      name: '원판 구매', 
      description: '가공 없이 원판만 구매하거나 기본 문의',
      options: PROCESSING_OPTIONS.filter(opt => opt.category === 'raw')
    },
    { 
      id: 'processing', 
      name: '가공 방식', 
      description: '레이저, CNC 등 가공 방법 선택 (택1)',
      options: PROCESSING_OPTIONS.filter(opt => opt.category === 'processing')
    },
    { 
      id: 'adhesion', 
      name: '접착 작업', 
      description: '무기포 및 일반 접착 선택 (택1)',
      options: PROCESSING_OPTIONS.filter(opt => opt.category === 'adhesion')
    }
  ];

  // 선택된 카테고리에 따라 표시할 카테고리 필터링
  const categories = React.useMemo(() => {
    if (!selectedCategory) return [];
    
    if (selectedCategory === 'raw') {
      return allCategories.filter(cat => cat.id === 'raw');
    } else if (selectedCategory === 'processing' || selectedCategory === 'complex') {
      return allCategories.filter(cat => cat.id === 'processing');
    } else if (selectedCategory === 'adhesion') {
      // 접착 가공은 가공 방식 + 접착 작업 둘 다 필요
      return allCategories.filter(cat => cat.id === 'processing' || cat.id === 'adhesion');
    }
    
    return [];
  }, [selectedCategory]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center space-y-3">
        <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
          가공 방법을 선택해주세요
        </h3>
        <p className="text-muted-foreground text-lg">
          가공 카테고리를 선택하고, 구체적인 옵션을 선택하세요
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm">
          <Sparkles className="w-4 h-4" />
          <span>가공과 접착은 독립적으로 선택 가능</span>
        </div>
      </div>

      {/* 가공 카테고리 선택 섹션 */}
      <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="w-5 h-5 text-primary" />
            가공 카테고리 설정
            <Badge variant="secondary" className="ml-auto">필수</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 원판구매 */}
            <div 
              className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                selectedCategory === 'raw' 
                  ? 'bg-primary/10 border-primary' 
                  : 'bg-background/80 border-border/50 hover:border-primary/30'
              }`}
              onClick={() => {
                setSelectedCategory('raw');
                onProcessingSelect('');
                onAdhesionSelect('');
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <Package className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sm">원판구매</span>
                {selectedCategory === 'raw' && (
                  <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                가공 없이 원판만 구매 또는 기본 문의
              </p>
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                하단 "원판 구매" 카테고리에서 선택
              </div>
            </div>

            {/* 재단 */}
            <div 
              className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                selectedCategory === 'processing'
                  ? 'bg-primary/10 border-primary' 
                  : 'bg-background/80 border-border/50 hover:border-primary/30'
              }`}
              onClick={() => {
                setSelectedCategory('processing');
                onComplexChange?.(false);
                onAdhesionSelect('');
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <Scissors className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sm">재단</span>
                {selectedCategory === 'processing' && (
                  <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                단순 재단 또는 기본 가공
              </p>
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                하단 "가공 방식"에서 구체적 방법 선택
              </div>
            </div>

            {/* 복잡한 모양 가공 */}
            <div 
              className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                selectedCategory === 'complex' 
                  ? 'bg-primary/10 border-primary' 
                  : 'bg-background/80 border-border/50 hover:border-primary/30'
              }`}
              onClick={() => {
                setSelectedCategory('complex');
                onComplexChange?.(true);
                onAdhesionSelect('');
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <Cpu className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sm">복잡한 모양 가공</span>
                {selectedCategory === 'complex' && (
                  <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                슬릿, 다공, 복잡한 형상 등 고급 가공
              </p>
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                레이저 complex 또는 CNC complex 자동 분류
              </div>
            </div>

            {/* 접착 가공 */}
            <div 
              className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                selectedCategory === 'adhesion' 
                  ? 'bg-primary/10 border-primary' 
                  : 'bg-background/80 border-border/50 hover:border-primary/30'
              }`}
              onClick={() => {
                setSelectedCategory('adhesion');
                onProcessingSelect('');
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <Droplet className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sm">접착 가공</span>
                {selectedCategory === 'adhesion' && (
                  <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                무기포 접착 및 일반 접착 작업
              </p>
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                하단 "접착 작업" 카테고리에서 선택
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-8" />
      
      {selectedCategory && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h4 className="text-2xl font-bold text-foreground">
              {selectedCategory === 'raw' && '원판 구매 옵션'}
              {(selectedCategory === 'processing' || selectedCategory === 'complex') && '가공 방식 선택'}
              {selectedCategory === 'adhesion' && '접착 작업 선택'}
            </h4>
            <p className="text-muted-foreground">
              원하시는 옵션을 선택해주세요
            </p>
          </div>
          
          <div className="grid grid-cols-1 max-w-4xl mx-auto gap-6">
            {categories.map((category, idx) => {
              const isAdhesion = category.id === 'adhesion';
              const selectedValue = isAdhesion ? selectedAdhesion : selectedProcessing;
              const handleSelect = isAdhesion ? onAdhesionSelect : onProcessingSelect;
              const CategoryIcon = getCategoryIcon(category.id);
              const hasSelection = selectedValue && category.options.some(opt => opt.id === selectedValue);
              
              return (
                <Card 
                  key={category.id} 
                  className={`border-2 transition-all duration-300 animate-fade-in ${
                    hasSelection 
                      ? 'border-primary bg-primary/5 shadow-lg' 
                      : 'border-border hover:border-primary/30 hover:shadow-md'
                  }`}
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl transition-colors ${
                        hasSelection ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        <CategoryIcon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-xl">{category.name}</CardTitle>
                          {hasSelection && (
                            <CheckCircle2 className="w-5 h-5 text-primary animate-scale-in" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* 접착 카테고리인 경우 수량 입력 추가 */}
                    {isAdhesion && (
                      <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                        <Label htmlFor="adhesion-qty" className="text-sm font-semibold flex items-center gap-2 mb-2">
                          <Package className="w-4 h-4 text-primary" />
                          제작 수량 (EA)
                        </Label>
                        <Input
                          id="adhesion-qty"
                          type="number"
                          min="1"
                          value={qty}
                          onChange={(e) => onQtyChange?.(parseInt(e.target.value) || 1)}
                          className="font-medium"
                          placeholder="수량을 입력하세요"
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                          접착 제작 시 여러 개를 만드는 경우 수량을 입력하세요
                        </p>
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      {category.options.map((option) => {
                        const isSelected = selectedValue === option.id;
                        return (
                          <button
                            key={option.id}
                            onClick={() => handleSelect(option.id)}
                            className={`w-full p-4 rounded-lg text-left transition-all duration-200 border-2 ${
                              isSelected
                                ? 'bg-primary text-primary-foreground border-primary shadow-md' 
                                : 'bg-card hover:bg-accent border-border hover:border-primary/30'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`mt-1 transition-transform ${isSelected ? 'scale-110' : ''}`}>
                                {isSelected ? (
                                  <CheckCircle2 className="w-5 h-5" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full border-2 border-current opacity-40" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className={`font-semibold text-base ${isSelected ? '' : 'text-foreground'}`}>
                                  {option.name}
                                </div>
                                <div className={`text-sm leading-relaxed ${
                                  isSelected ? 'opacity-95' : 'text-muted-foreground'
                                }`}>
                                  {option.description}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessingOptions;
