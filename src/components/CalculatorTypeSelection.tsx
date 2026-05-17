import React from 'react';
import { Calculator, TrendingUp } from "lucide-react";

interface CalculatorTypeSelectionProps {
  onTypeSelect: (type: 'quote' | 'yield') => void;
}

const CalculatorTypeSelection: React.FC<CalculatorTypeSelectionProps> = ({
  onTypeSelect
}) => {
  const options = [
    {
      type: 'yield' as const,
      title: '수율 계산기',
      description: '원판 배치, 사용률, 재활용 가능한 잔재를 먼저 확인합니다.',
      icon: TrendingUp,
      tone: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/15',
    },
    {
      type: 'quote' as const,
      title: '견적 계산기',
      description: '판재 단가, 색상, 면수, 가공 옵션을 기준으로 견적을 계산합니다.',
      icon: Calculator,
      tone: 'text-primary bg-primary/10 border-primary/15',
    },
  ];

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h3 className="mb-2 text-lg font-semibold text-foreground sm:text-xl">계산 목적을 선택해주세요</h3>
        <p className="text-sm text-muted-foreground">작업 흐름에 맞는 계산기를 선택하면 다음 단계로 이동합니다.</p>
      </div>
      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-3 md:grid-cols-2">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.type}
              type="button"
              className="group flex min-h-[136px] items-start gap-4 rounded-2xl border border-border/70 bg-background/75 p-5 text-left shadow-sm backdrop-blur transition-colors hover:bg-accent/35"
              onClick={() => onTypeSelect(option.type)}
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${option.tone}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold text-foreground">{option.title}</span>
                <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CalculatorTypeSelection;
