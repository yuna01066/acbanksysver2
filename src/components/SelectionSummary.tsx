
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Material, Quality } from "@/types/calculator";
import { SizeQuantitySelection } from "./MultipleSizeSelection";
import { Package, Layers, Palette, DollarSign, Calculator, Receipt } from "lucide-react";
import { formatPrice } from "@/utils/priceCalculations";

interface SelectionSummaryProps {
  selectedFactory?: string;
  selectedMaterial: Material | null;
  selectedQuality: Quality | null;
  selectedColor: string;
  selectedThickness: string;
  selectedSize: string;
  selectedSizes?: SizeQuantitySelection[];
  selectedColorType: string;
  selectedSurface: string;
  colorMixingCost: number;
  selectedProcessing: string;
  selectedAdhesion: string;
  processingOptions: { id: string; name: string }[];
  factories?: { id: string; name: string }[];
  basePrice?: number;
  priceInfo?: {
    totalPrice: number;
    breakdown: { label: string; price: number }[];
  };
}

const SelectionSummary: React.FC<SelectionSummaryProps> = ({
  selectedFactory,
  selectedMaterial,
  selectedQuality,
  selectedColor,
  selectedThickness,
  selectedSize,
  selectedSizes,
  selectedColorType,
  selectedSurface,
  colorMixingCost,
  selectedProcessing,
  selectedAdhesion,
  processingOptions,
  factories,
  basePrice,
  priceInfo
}) => {
  const getSizeBaseName = (sizeString: string): string => {
    const match = sizeString.match(/^(.+?) \(/);
    return match ? match[1] : sizeString;
  };

  if (!selectedMaterial) return null;

  return (
    <Card className="mb-6 border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          선택된 옵션 상세
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 기본 정보 */}
        <div className="space-y-2">
          <h5 className="text-sm font-semibold text-muted-foreground">기본 정보</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {selectedMaterial && (
              <div className="p-3 bg-background rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">소재</div>
                <div className="font-medium">{selectedMaterial.name}</div>
              </div>
            )}
            {selectedQuality && (
              <div className="p-3 bg-background rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">재질</div>
                <div className="font-medium">{selectedQuality.name}</div>
              </div>
            )}
            {selectedThickness && (
              <div className="p-3 bg-background rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">두께</div>
                <div className="font-medium">{selectedThickness}</div>
              </div>
            )}
            {selectedColor && (
              <div className="p-3 bg-background rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">색상 코드</div>
                <div className="font-medium">{selectedColor}</div>
              </div>
            )}
            {selectedColorType && (
              <div className="p-3 bg-background rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">색상 종류</div>
                <div className="font-medium">{selectedColorType}</div>
              </div>
            )}
          </div>
        </div>

        {/* 여러 원판 선택된 경우 */}
        {selectedSizes && selectedSizes.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Layers className="w-4 h-4" />
              선택된 원판 ({selectedSizes.length}개)
            </h5>
            <div className="space-y-3">
              {selectedSizes.map((sizeItem, index) => {
                const baseName = getSizeBaseName(sizeItem.size);
                const itemColorMixingCost = sizeItem.colorMixingCost || 0;
                const surfaceAdditionalCost = sizeItem.surfaceAdditionalCost || 0;
                
                // priceInfo.breakdown에서 해당 원판의 금액 찾기
                const wonJangLabel = `원장 #${index + 1}`;
                const wonJangItem = priceInfo?.breakdown.find(item => item.label.includes(wonJangLabel));
                const wonJangTotal = wonJangItem?.price || 0;
                
                return (
                  <Card key={index} className="border-2 border-primary/20 bg-gradient-to-br from-background to-muted/30">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-lg mb-1">원판 #{index + 1}</div>
                          <div className="text-sm text-muted-foreground">
                            {baseName}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {sizeItem.size}
                          </div>
                        </div>
                        <Badge variant="default" className="ml-2">
                          {sizeItem.quantity}EA
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {sizeItem.surface && (
                          <div className="p-2 bg-muted/50 rounded border border-border/50">
                            <div className="text-xs text-muted-foreground">면수</div>
                            <div className="font-medium text-sm">{sizeItem.surface}</div>
                          </div>
                        )}
                        <div className="p-2 bg-muted/50 rounded border border-border/50">
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Palette className="w-3 h-3" />
                            조색비
                          </div>
                          <div className="font-medium text-sm text-primary">
                            {formatPrice(itemColorMixingCost)}
                          </div>
                        </div>
                      </div>

                      {/* 원판 금액 상세 */}
                      <div className="pt-3 border-t-2 border-primary/20">
                        <div className="bg-primary/5 rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">
                              원판 금액
                            </span>
                            <span className="font-semibold text-lg text-primary">
                              {formatPrice(wonJangTotal)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground pt-1 border-t border-border/30">
                            원판 + 면수(테이프) + 조색비 포함
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* 단일 원판 선택된 경우 */}
        {selectedSize && (!selectedSizes || selectedSizes.length === 0) && (
          <div className="space-y-2">
            <h5 className="text-sm font-semibold text-muted-foreground">원판 정보</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="p-3 bg-background rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">사이즈</div>
                <div className="font-medium">{selectedSize}</div>
              </div>
              {selectedSurface && (
                <div className="p-3 bg-background rounded-lg border">
                  <div className="text-xs text-muted-foreground mb-1">면수</div>
                  <div className="font-medium">{selectedSurface}</div>
                </div>
              )}
              {colorMixingCost > 0 && (
                <div className="p-3 bg-background rounded-lg border">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Palette className="w-3 h-3" />
                    조색비
                  </div>
                  <div className="font-medium text-primary">{formatPrice(colorMixingCost)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 가공 옵션 */}
        {(selectedProcessing || selectedAdhesion) && (
          <div className="space-y-2">
            <h5 className="text-sm font-semibold text-muted-foreground">가공 옵션</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {selectedProcessing && (
                <div className="p-3 bg-background rounded-lg border">
                  <div className="text-xs text-muted-foreground mb-1">가공 방식</div>
                  <div className="font-medium">
                    {processingOptions.find(p => p.id === selectedProcessing)?.name}
                  </div>
                </div>
              )}
              {selectedAdhesion && (
                <div className="p-3 bg-background rounded-lg border">
                  <div className="text-xs text-muted-foreground mb-1">접착 작업</div>
                  <div className="font-medium">
                    {selectedAdhesion === 'bond-normal' && '일반 접착'}
                    {selectedAdhesion === 'bond-mugipo-auto' && '무기포 접착 (자동)'}
                    {selectedAdhesion === 'bond-mugipo-45' && '무기포 접착 45°'}
                    {selectedAdhesion === 'bond-mugipo-90' && '무기포 접착 90°'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 가격 계산 결과 */}
        {priceInfo && priceInfo.totalPrice > 0 && (
          <div className="space-y-2 mt-6 pt-6 border-t-2 border-primary/30">
            <h5 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              가격 계산 결과
            </h5>
            
            <div className="space-y-3 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="w-4 h-4 text-muted-foreground" />
                <h6 className="font-medium text-sm text-muted-foreground">가격 구성 내역</h6>
              </div>
              
              {priceInfo.breakdown.map((item, index) => (
                <div 
                  key={index} 
                  className="flex justify-between items-center py-2 px-3 bg-muted/50 rounded-lg border border-border/50"
                >
                  <span className="text-sm font-medium text-foreground">
                    {item.label}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatPrice(item.price)}
                  </span>
                </div>
              ))}
              
              {/* 최종 견적가 강조 */}
              <Card className="border-2 border-primary bg-primary/10 mt-4">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      최종 견적가
                    </span>
                    <span className="text-2xl font-bold text-primary">
                      {formatPrice(priceInfo.totalPrice)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SelectionSummary;
