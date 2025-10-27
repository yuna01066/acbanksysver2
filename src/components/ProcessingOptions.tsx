import React from 'react';
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";

interface ProcessingOption {
  id: string;
  name: string;
  description: string;
  category: 'raw' | 'cutting' | 'special' | 'adhesion';
}

const PROCESSING_OPTIONS: ProcessingOption[] = [
  { 
    id: 'raw-only', 
    name: '원판 단독 구매', 
    description: '가공 없이 원판만 구매 (자재비에만 ×1.3 적용)', 
    category: 'raw' 
  },
  { 
    id: 'auto', 
    name: '자동 선택 (권장)', 
    description: '두께와 복잡도에 따라 최적 가공 방식 자동 선택 (10T 미만: 레이저, 10T 이상: CNC)', 
    category: 'cutting' 
  },
  { 
    id: 'simple-cutting', 
    name: '단순 재단', 
    description: '기본 직선 재단 (10T 미만: 자재비 증분 +20%, 10T 이상: +80%)', 
    category: 'cutting' 
  },
  { 
    id: 'laser-simple', 
    name: '레이저 단순 가공', 
    description: '10T 미만 적합, 단순 모양 레이저 커팅 (배수 1.7 × 두께계수)', 
    category: 'cutting' 
  },
  { 
    id: 'laser-complex', 
    name: '레이저 복합 가공', 
    description: '10T 미만 적합, 복잡한 모양 레이저 커팅 (배수 2.0 × 두께계수)', 
    category: 'cutting' 
  },
  { 
    id: 'cnc-simple', 
    name: 'CNC 단순 가공', 
    description: '10T 이상 적합, 단순 CNC 가공 (배수 1.8 × 두께계수)', 
    category: 'special' 
  },
  { 
    id: 'cnc-complex', 
    name: 'CNC 복합 가공', 
    description: '10T 이상 적합, 복잡한 CNC 가공 (배수 2.5 × 두께계수)', 
    category: 'special' 
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
  },
  { 
    id: 'none', 
    name: '가공 없음', 
    description: '자재비에만 기본 문의 배수 적용 (×1.2)', 
    category: 'raw' 
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
  const categories = [
    { 
      id: 'raw', 
      name: '원판 구매', 
      options: PROCESSING_OPTIONS.filter(opt => opt.category === 'raw')
    },
    { 
      id: 'cutting', 
      name: '재단/가공 (상호배타)', 
      options: PROCESSING_OPTIONS.filter(opt => opt.category === 'cutting')
    },
    { 
      id: 'special', 
      name: 'CNC 가공 (상호배타)', 
      options: PROCESSING_OPTIONS.filter(opt => opt.category === 'special')
    },
    { 
      id: 'adhesion', 
      name: '접착 작업 (상호배타)', 
      options: PROCESSING_OPTIONS.filter(opt => opt.category === 'adhesion')
    }
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          8. 가공 방법을 선택해주세요
        </h3>
        <p className="text-gray-600">가공과 접착은 각각 독립적으로 선택 가능합니다 (각 카테고리 내에서는 택1)</p>
      </div>
      
      <div className="space-y-6">
        {categories.map((category) => {
          const isAdhesion = category.id === 'adhesion';
          const selectedValue = isAdhesion ? selectedAdhesion : selectedProcessing;
          const handleSelect = isAdhesion ? onAdhesionSelect : onProcessingSelect;
          
          return (
            <div key={category.id} className="p-6 bg-gray-50 rounded-xl border border-gray-100">
              <h4 className="text-lg font-semibold mb-4 text-gray-900">{category.name}</h4>
              <div className="space-y-3">
                {category.options.map((option) => (
                  <Button
                    key={option.id}
                    variant={selectedValue === option.id ? "default" : "outline"}
                    className={`w-full p-4 h-auto flex flex-col items-start text-left transition-all duration-200 ${
                      selectedValue === option.id 
                        ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800' 
                        : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-900'
                    }`}
                    onClick={() => handleSelect(option.id)}
                  >
                    <div className="font-semibold text-base mb-1">{option.name}</div>
                    <div className="text-sm opacity-80 leading-relaxed">{option.description}</div>
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default ProcessingOptions;
