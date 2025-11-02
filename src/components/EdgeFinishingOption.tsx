import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useProcessingOptions } from "@/hooks/useProcessingOptions";

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
  const { activeAdditionalOptions, isLoading } = useProcessingOptions();

  const optionStates: Record<string, { value: boolean; onChange?: (enabled: boolean) => void }> = {
    edgeFinishing: { value: edgeFinishing, onChange: onEdgeFinishingChange },
    bulgwang: { value: bulgwang, onChange: onBulgwangChange },
    tapung: { value: tapung, onChange: onTapungChange },
    mugwangPainting: { value: mugwangPainting, onChange: onMugwangPaintingChange }
  };

  if (isLoading || !activeAdditionalOptions || activeAdditionalOptions.length === 0) {
    return null;
  }

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
        {activeAdditionalOptions.map((option) => {
          const state = optionStates[option.option_id];
          if (!state) return null;

          return (
            <div 
              key={option.id}
              className="flex items-start space-x-3 p-4 bg-background/80 rounded-lg border-2 border-amber-200 dark:border-amber-800 hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
            >
              <Checkbox
                id={option.option_id}
                checked={state.value}
                onCheckedChange={(checked) => state.onChange?.(checked as boolean)}
                className="mt-1"
              />
              <Label
                htmlFor={option.option_id}
                className="text-sm font-medium cursor-pointer flex-1 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-base">{option.name}</span>
                </div>
                {option.description && (
                  <p className="text-muted-foreground leading-relaxed">
                    {option.description}
                  </p>
                )}
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
