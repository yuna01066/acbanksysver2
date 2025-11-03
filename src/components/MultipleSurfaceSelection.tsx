import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Square, Layers, ArrowRight } from "lucide-react";
import { SizeQuantitySelection } from "./MultipleSizeSelection";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
  tapePrices, 
  astelDoubleSideSurcharge, 
  satinDoubleSideSurcharge 
} from "@/data/glossyColorPricing";

interface MultipleSurfaceSelectionProps {
  selectedSizes: SizeQuantitySelection[];
  onSelectionChange: (selections: SizeQuantitySelection[]) => void;
  onNext: () => void;
  isGlossyStandard?: boolean;
  forceSingle?: boolean;
  qualityId?: string; // 재질 ID로 추가금액 계산
}

const MultipleSurfaceSelection: React.FC<MultipleSurfaceSelectionProps> = ({
  selectedSizes,
  onSelectionChange,
  onNext,
  isGlossyStandard = false,
  forceSingle = false,
  qualityId,
}) => {
  // 사이즈에서 기본 이름 추출 (예: "3*6 (860*1750)" -> "3*6")
  const extractBaseName = (sizeString: string): string => {
    const match = sizeString.match(/^([^\(]+)/);
    return match ? match[1].trim() : sizeString;
  };

  // 면수 추가금액 계산
  const calculateSurfaceAdditionalCost = (size: string, surface: string): number => {
    if (surface !== '양면') return 0;
    
    const baseName = extractBaseName(size);
    
    switch (qualityId) {
      case 'glossy-color':
      case 'glossy-standard':
        return tapePrices[baseName as keyof typeof tapePrices] || 0;
      
      case 'astel-color':
        const astelTape = tapePrices[baseName as keyof typeof tapePrices] || 0;
        const astelSurcharge = astelDoubleSideSurcharge[baseName as keyof typeof astelDoubleSideSurcharge] || 0;
        return astelTape + astelSurcharge;
      
      case 'satin-color':
        return satinDoubleSideSurcharge[baseName as keyof typeof satinDoubleSideSurcharge] || 0;
      
      default:
        return 0;
    }
  };

  const handleSurfaceChange = (size: string, surface: string) => {
    const surfaceAdditionalCost = calculateSurfaceAdditionalCost(size, surface);
    
    onSelectionChange(
      selectedSizes.map(item => 
        item.size === size ? { ...item, surface, surfaceAdditionalCost } : item
      )
    );
  };

  const allSurfacesSelected = selectedSizes.every(item => item.surface);

  const getSizeBaseName = (sizeString: string): string => {
    const match = sizeString.match(/^(.+?) \(/);
    return match ? match[1] : sizeString;
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold mb-2">각 판재의 면수를 선택해 주세요</h3>
        <p className="text-muted-foreground">
          선택한 각 사이즈별로 단면 또는 양면을 설정하세요
        </p>
      </div>

      <div className="space-y-4">
        {selectedSizes.map((item) => {
          const baseName = getSizeBaseName(item.size);
          const selectedSurface = item.surface || '';

          return (
            <Card 
              key={item.size}
              className={`border-2 transition-all ${
                item.surface 
                  ? 'border-primary/30 bg-primary/5' 
                  : 'border-border/50'
              }`}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{baseName}</span>
                    <Badge variant="outline">{item.quantity}EA</Badge>
                  </div>
                  {item.surface && (
                    <Badge variant="default">
                      {item.surface === '단면' ? '단면 선택됨' : '양면 선택됨'}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup 
                  value={selectedSurface}
                  onValueChange={(value) => handleSurfaceChange(item.size, value)}
                  className="grid grid-cols-2 gap-4"
                  disabled={forceSingle}
                >
                  <div 
                    className={`flex items-center space-x-2 p-4 border-2 rounded-lg hover:border-primary/50 transition-colors ${
                      selectedSurface === '단면' 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border/50 bg-background'
                    }`}
                  >
                    <RadioGroupItem value="단면" id={`single-${item.size}`} />
                    <Label 
                      htmlFor={`single-${item.size}`}
                      className="flex items-center gap-3 cursor-pointer flex-1"
                    >
                      <Square className="w-6 h-6 text-primary" />
                      <div>
                        <div className="font-semibold">단면</div>
                        <div className="text-xs text-muted-foreground">
                          한쪽 면만 처리
                        </div>
                      </div>
                    </Label>
                  </div>

                  <div 
                    className={`flex items-center space-x-2 p-4 border-2 rounded-lg hover:border-primary/50 transition-colors ${
                      selectedSurface === '양면' 
                        ? 'border-primary bg-primary/10' 
                        : forceSingle 
                        ? 'border-border/30 bg-muted/30 opacity-50' 
                        : 'border-border/50 bg-background'
                    }`}
                  >
                    <RadioGroupItem 
                      value="양면" 
                      id={`double-${item.size}`}
                      disabled={forceSingle}
                    />
                    <Label 
                      htmlFor={`double-${item.size}`}
                      className={`flex items-center gap-3 flex-1 ${
                        forceSingle ? 'cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      <Layers className="w-6 h-6 text-primary" />
                      <div>
                        <div className="font-semibold">양면</div>
                        <div className="text-xs text-muted-foreground">
                          양쪽 면 모두 처리
                          {forceSingle && <span className="block text-destructive">사용 불가</span>}
                        </div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>

                {isGlossyStandard && (
                  <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-primary">참고:</span> 투명 글로시는 단면 처리 시 자동으로 양면 가격이 적용됩니다
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {forceSingle && (
        <div className="p-4 bg-amber-500/10 border-2 border-amber-500/30 rounded-lg">
          <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
            ⚠️ 브라이트 및 아스텔 아크릴은 양면 가공이 불가능합니다
          </p>
        </div>
      )}

      {/* 다음 단계 버튼 */}
      <div className="pt-4">
        <Button
          onClick={onNext}
          disabled={!allSurfacesSelected}
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

export default MultipleSurfaceSelection;
