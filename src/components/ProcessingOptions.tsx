import React from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Package, Scissors, Cpu, Droplet, Sparkles, CheckCircle2 } from "lucide-react";

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
}

const ProcessingOptions: React.FC<ProcessingOptionsProps> = ({
  selectedProcessing,
  selectedAdhesion,
  onProcessingSelect,
  onAdhesionSelect,
  isGlossyStandard
}) => {
  const getCategoryIcon = (categoryId: string) => {
    switch (categoryId) {
      case 'raw': return Package;
      case 'processing': return Scissors;
      case 'adhesion': return Droplet;
      default: return Sparkles;
    }
  };

  const categories = [
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

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center space-y-3">
        <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
          가공 방법을 선택해주세요
        </h3>
        <p className="text-muted-foreground text-lg">
          각 카테고리에서 필요한 옵션을 선택하세요
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm">
          <Sparkles className="w-4 h-4" />
          <span>가공과 접착은 독립적으로 선택 가능</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {categories.map((category, idx) => {
          const isAdhesion = category.id === 'adhesion';
          const selectedValue = isAdhesion ? selectedAdhesion : selectedProcessing;
          const handleSelect = isAdhesion ? onAdhesionSelect : onProcessingSelect;
          const CategoryIcon = getCategoryIcon(category.id);
          const hasSelection = selectedValue && category.options.some(opt => opt.id === selectedValue);
          
          return (
            <Card 
              key={category.id} 
              className={`p-6 border-2 transition-all duration-300 hover:shadow-lg animate-fade-in ${
                hasSelection 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50'
              }`}
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className="flex items-start gap-4 mb-5">
                <div className={`p-3 rounded-xl transition-colors ${
                  hasSelection ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  <CategoryIcon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-bold text-foreground">{category.name}</h4>
                    {hasSelection && (
                      <CheckCircle2 className="w-5 h-5 text-primary animate-scale-in" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                {category.options.map((option) => {
                  const isSelected = selectedValue === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleSelect(option.id)}
                      className={`w-full p-4 rounded-lg text-left transition-all duration-200 border-2 ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]' 
                          : 'bg-card hover:bg-muted border-border hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 transition-transform ${isSelected ? 'scale-110' : ''}`}>
                          {isSelected ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-current opacity-30" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`font-semibold mb-1 ${isSelected ? '' : 'text-foreground'}`}>
                            {option.name}
                          </div>
                          <div className={`text-sm leading-relaxed ${
                            isSelected ? 'opacity-90' : 'text-muted-foreground'
                          }`}>
                            {option.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ProcessingOptions;
