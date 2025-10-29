import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Palette, Plus, Minus, ArrowRight } from "lucide-react";
import { SizeQuantitySelection } from "./MultipleSizeSelection";

interface MultipleColorMixingStepProps {
  selectedSizes: SizeQuantitySelection[];
  onSelectionChange: (selections: SizeQuantitySelection[]) => void;
  onNext: () => void;
  isGlossyStandard?: boolean;
  isFilmAcrylic?: boolean;
}

const MultipleColorMixingStep: React.FC<MultipleColorMixingStepProps> = ({
  selectedSizes,
  onSelectionChange,
  onNext,
  isGlossyStandard = false,
  isFilmAcrylic = false,
}) => {
  // 초기 렌더링 시 조색비가 없는 항목에 기본값 설정
  React.useEffect(() => {
    const needsInit = selectedSizes.some(item => item.colorMixingCost === undefined);
    if (needsInit) {
      onSelectionChange(
        selectedSizes.map(item => ({
          ...item,
          colorMixingCost: item.colorMixingCost ?? 20000
        }))
      );
    }
  }, []);

  const handleColorMixingChange = (size: string, delta: number) => {
    onSelectionChange(
      selectedSizes.map(item => {
        if (item.size === size) {
          const currentCost = item.colorMixingCost || 20000;
          const newCost = Math.max(0, currentCost + delta);
          return { ...item, colorMixingCost: newCost };
        }
        return item;
      })
    );
  };

  const getSizeBaseName = (sizeString: string): string => {
    const match = sizeString.match(/^(.+?) \(/);
    return match ? match[1] : sizeString;
  };

  const allCostsSet = selectedSizes.every(item => 
    item.colorMixingCost !== undefined && item.colorMixingCost >= 0
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold mb-2">7. 각 판재의 조색비를 설정해주세요</h3>
        <p className="text-muted-foreground">
          선택한 각 사이즈별로 조색비를 설정하세요 (기본: 20,000원)
        </p>
      </div>

      <div className="space-y-4">
        {selectedSizes.map((item) => {
          const baseName = getSizeBaseName(item.size);
          const colorMixingCost = item.colorMixingCost ?? 20000;

          return (
            <Card 
              key={item.size}
              className="border-2 border-primary/30 bg-gradient-to-br from-background to-muted/30"
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <Palette className="w-5 h-5 text-primary" />
                    <span className="font-semibold">{baseName}</span>
                    <Badge variant="outline">{item.quantity}EA</Badge>
                    <Badge variant="secondary">{item.surface}</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">조색비</div>
                      <div className="text-2xl font-bold text-primary">
                        {colorMixingCost.toLocaleString()}원
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleColorMixingChange(item.size, -10000)}
                        disabled={colorMixingCost <= 0 || isGlossyStandard || isFilmAcrylic}
                      >
                        <Minus className="w-4 h-4" />
                        10,000원
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleColorMixingChange(item.size, 10000)}
                        disabled={isGlossyStandard || isFilmAcrylic}
                      >
                        <Plus className="w-4 h-4" />
                        10,000원
                      </Button>
                    </div>
                  </div>

                  {(isGlossyStandard || isFilmAcrylic) && (
                    <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
                      <p className="text-xs text-muted-foreground">
                        {isGlossyStandard && (
                          <>
                            <span className="font-semibold">참고:</span> 투명 글로시는 조색비가 고정되어 있습니다
                          </>
                        )}
                        {isFilmAcrylic && (
                          <>
                            <span className="font-semibold">참고:</span> 필름 아크릴은 조색비가 고정되어 있습니다
                          </>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 총 조색비 요약 */}
      <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-lg">총 조색비</span>
            <span className="text-2xl font-bold text-primary">
              {selectedSizes.reduce((sum, item) => sum + (item.colorMixingCost || 20000), 0).toLocaleString()}원
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 다음 단계 버튼 */}
      <div className="pt-4">
        <Button
          onClick={onNext}
          disabled={!allCostsSet}
          size="lg"
          className="w-full text-base font-semibold"
        >
          다음 단계로
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default MultipleColorMixingStep;
