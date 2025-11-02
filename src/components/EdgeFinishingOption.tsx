import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface AdditionalOption {
  id: string;
  label: string;
  description: string;
  multiplier: number;
  badge?: string;
}

const ADDITIONAL_OPTIONS: AdditionalOption[] = [
  {
    id: 'edgeFinishing',
    label: '엣지 격면 마감',
    description: '엣지 연마 및 격면 마감 처리로 깔끔한 마감을 제공합니다',
    multiplier: 0.5,
    badge: '고급 마감'
  },
  {
    id: 'bulgwang',
    label: '불광 마감',
    description: '불광 처리로 고급스러운 질감을 제공합니다',
    multiplier: 0.5,
    badge: '고급 마감'
  },
  {
    id: 'tapung',
    label: '타공',
    description: '타공 처리로 원하는 위치에 구멍을 가공합니다',
    multiplier: 0.2,
    badge: '가공'
  },
  {
    id: 'mugwangPainting',
    label: '무광 도장',
    description: '무광 도장 처리로 부드러운 마감을 제공합니다',
    multiplier: 2.0,
    badge: '프리미엄'
  }
];

interface EdgeFinishingOptionProps {
  edgeFinishing?: boolean;
  onEdgeFinishingChange?: (enabled: boolean) => void;
  bulgwang?: boolean;
  onBulgwangChange?: (enabled: boolean) => void;
  tapung?: boolean;
  onTapungChange?: (enabled: boolean) => void;
  mugwangPainting?: boolean;
  onMugwangPaintingChange?: (enabled: boolean) => void;
}

const EdgeFinishingOption = ({
  edgeFinishing = false,
  onEdgeFinishingChange,
  bulgwang = false,
  onBulgwangChange,
  tapung = false,
  onTapungChange,
  mugwangPainting = false,
  onMugwangPaintingChange,
}: EdgeFinishingOptionProps) => {
  const optionStates = {
    edgeFinishing: { value: edgeFinishing, onChange: onEdgeFinishingChange },
    bulgwang: { value: bulgwang, onChange: onBulgwangChange },
    tapung: { value: tapung, onChange: onTapungChange },
    mugwangPainting: { value: mugwangPainting, onChange: onMugwangPaintingChange }
  };

  return (
    <Card className="mt-6 border-2 border-amber-200 dark:border-amber-900 bg-gradient-to-br from-amber-50/50 to-background dark:from-amber-950/20 dark:to-background">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-lg">
          <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <span className="bg-gradient-to-r from-amber-600 to-amber-500 bg-clip-text text-transparent">
            추가 옵션
          </span>
          <Badge variant="secondary" className="text-xs ml-auto">
            선택사항
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {ADDITIONAL_OPTIONS.map((option) => {
          const state = optionStates[option.id as keyof typeof optionStates];
          return (
            <div 
              key={option.id}
              className="flex items-start space-x-3 p-4 bg-background/80 rounded-lg border-2 border-amber-200 dark:border-amber-800 hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
            >
              <Checkbox
                id={option.id}
                checked={state.value}
                onCheckedChange={(checked) => state.onChange?.(checked as boolean)}
                className="mt-1"
              />
              <Label
                htmlFor={option.id}
                className="text-sm font-medium cursor-pointer flex-1 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-base">{option.label}</span>
                  {option.badge && (
                    <Badge variant="outline" className="text-xs">
                      {option.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  {option.description}
                </p>
                <div className="flex items-start gap-2 pt-1">
                  <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs">
                    <div className="text-amber-700 dark:text-amber-300 font-medium">
                      • 원판금액 × {option.multiplier}
                    </div>
                  </div>
                </div>
              </Label>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default EdgeFinishingOption;
