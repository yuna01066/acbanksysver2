import React from 'react';
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";

interface ProcessingOption {
  id: string;
  name: string;
  description: string;
  category: 'raw' | 'cutting' | 'edge' | 'special';
}

const PROCESSING_OPTIONS: ProcessingOption[] = [
  { 
    id: 'raw-only', 
    name: '원판 단독 구매', 
    description: '가공 없이 원판만 구매 (단순재단보다 비쌈)', 
    category: 'raw' 
  },
  { 
    id: 'simple-cutting', 
    name: '단순 재단', 
    description: '가로+세로 1컷씩 기본 재단 (10T 미만: ×1.2, 10T 이상: ×1.8)', 
    category: 'cutting' 
  },
  { 
    id: 'complex-cutting', 
    name: '복합 재단', 
    description: '도면 기반 다양한 재단 요청 포함 (×1.2)', 
    category: 'cutting' 
  },
  { 
    id: 'edge-finishing', 
    name: '엣지 격면 마감', 
    description: '연마/면취 등 고급 가공 (10T 이하: ×1.8, 10T 초과: ×2.0)', 
    category: 'edge' 
  },
  { 
    id: 'bubble-free-adhesion', 
    name: '무기포 접착', 
    description: '고급 무기포 방식 접착 (총 금액 ×3)', 
    category: 'special' 
  },
  { 
    id: 'laser-cutting-simple', 
    name: '레이저 커팅 (단순)', 
    description: '단순 모양 레이저 커팅 (10T 이하: +5만원, 10T 초과: ×1.2+7만원)', 
    category: 'special' 
  },
  { 
    id: 'laser-cutting-full', 
    name: '전체 레이저 커팅', 
    description: '1~2T 전체판 가공시 고정 20만원, 그 외는 복합가공', 
    category: 'special' 
  },
  { 
    id: 'cnc-general', 
    name: 'CNC 일반 가공', 
    description: '단순 컷/도려내기 등 (+7만원)', 
    category: 'special' 
  },
  { 
    id: 'cnc-heavy', 
    name: 'CNC 고강도 가공', 
    description: '20~30T 두꺼운 판재 고정밀 가공 (+10만원)', 
    category: 'special' 
  },
  { 
    id: 'complex-shapes', 
    name: '복잡한 모양 가공', 
    description: '한 판에 다양한 형태 포함 (+15~20만원)', 
    category: 'special' 
  }
];

interface ProcessingOptionsProps {
  selectedProcessing: string;
  onProcessingSelect: (processingId: string) => void;
  isGlossyStandard: boolean;
}

const ProcessingOptions: React.FC<ProcessingOptionsProps> = ({
  selectedProcessing,
  onProcessingSelect,
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
      name: '재단 가공', 
      options: PROCESSING_OPTIONS.filter(opt => opt.category === 'cutting')
    },
    { 
      id: 'edge', 
      name: '엣지 마감', 
      options: PROCESSING_OPTIONS.filter(opt => opt.category === 'edge')
    },
    { 
      id: 'special', 
      name: '특수 가공', 
      options: PROCESSING_OPTIONS.filter(opt => opt.category === 'special')
    }
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          {isGlossyStandard ? '8.' : '7.'} 가공 방법을 선택해주세요
        </h3>
        <p className="text-gray-600">필요한 가공 방식을 선택하여 정확한 견적을 받아보세요</p>
      </div>
      
      <div className="space-y-6">
        {categories.map((category) => (
          <div key={category.id} className="p-6 bg-gray-50 rounded-xl border border-gray-100">
            <h4 className="text-lg font-semibold mb-4 text-gray-900">{category.name}</h4>
            <div className="space-y-3">
              {category.options.map((option) => (
                <Button
                  key={option.id}
                  variant={selectedProcessing === option.id ? "default" : "outline"}
                  className={`w-full p-4 h-auto flex flex-col items-start text-left transition-all duration-200 ${
                    selectedProcessing === option.id 
                      ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800' 
                      : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-900'
                  }`}
                  onClick={() => onProcessingSelect(option.id)}
                >
                  <div className="font-semibold text-base mb-1">{option.name}</div>
                  <div className="text-sm opacity-80 leading-relaxed">{option.description}</div>
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default ProcessingOptions;
