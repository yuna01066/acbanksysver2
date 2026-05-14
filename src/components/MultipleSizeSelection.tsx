import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Trash2, ShoppingCart, ArrowRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const DEFAULT_COLOR_MIXING_COST = 40000;

interface PanelSizeInfo {
  baseName: string;
  baseWidth: number;
  baseHeight: number;
  availableWidth: number;
  availableHeight: number;
}

export interface SizeQuantitySelection {
  size: string;
  quantity: number;
  surface?: string; // 단면/양면
  colorMixingCost?: number; // 조색비
  surfaceAdditionalCost?: number; // 면수 추가금액 (양단면 등)
}

interface MultipleSizeSelectionProps {
  availableSizes: string[];
  selectedSizes: SizeQuantitySelection[];
  onSelectionChange: (selections: SizeQuantitySelection[]) => void;
  onNext: () => void;
  selectedThickness?: string;
}

const MultipleSizeSelection: React.FC<MultipleSizeSelectionProps> = ({
  availableSizes,
  selectedSizes,
  onSelectionChange,
  onNext,
  selectedThickness
}) => {
  // 두께에 따른 가용사이즈 계산
  const getPanelSizeInfo = (sizeString: string): PanelSizeInfo => {
    const match = sizeString.match(/^(.+?) \((\d+)\*(\d+)\)$/);
    if (match) {
      const baseName = match[1];
      const availableWidth = parseInt(match[2]);
      const availableHeight = parseInt(match[3]);
      
      const baseSizeMapping: { [key: string]: { width: number; height: number } } = {
        '3*6': { width: 860, height: 1750 },
        '대3*6': { width: 900, height: 1800 },
        '4*5': { width: 1120, height: 1425 },
        '대4*5': { width: 1200, height: 1500 },
        '1*2': { width: 1000, height: 2000 },
        '4*6': { width: 1200, height: 1800 },
        '4*8': { width: 1200, height: 2400 },
        '4*10': { width: 1200, height: 3000 },
        '5*6': { width: 1500, height: 1800 },
        '5*8': { width: 1500, height: 2400 }
      };
      
      const baseSize = baseSizeMapping[baseName];
      return {
        baseName,
        baseWidth: baseSize?.width || availableWidth,
        baseHeight: baseSize?.height || availableHeight,
        availableWidth,
        availableHeight
      };
    }
    
    return {
      baseName: sizeString,
      baseWidth: 1000,
      baseHeight: 1000,
      availableWidth: 1000,
      availableHeight: 1000
    };
  };

  const handleSizeToggle = (size: string) => {
    const existing = selectedSizes.find(s => s.size === size);
    if (existing) {
      // 이미 선택된 경우 제거
      onSelectionChange(selectedSizes.filter(s => s.size !== size));
    } else {
      // 새로 추가 (기본 수량 1, 조색비 40000원, 기본 면수 단면)
      onSelectionChange([...selectedSizes, { 
        size, 
        quantity: 1,
        surface: '단면',
        colorMixingCost: DEFAULT_COLOR_MIXING_COST
      }]);
    }
  };

  const handleQuantityChange = (size: string, quantity: number) => {
    if (quantity < 1) return;
    onSelectionChange(
      selectedSizes.map(s => 
        s.size === size ? { ...s, quantity } : s
      )
    );
  };

  const handleRemove = (size: string) => {
    onSelectionChange(selectedSizes.filter(s => s.size !== size));
  };

  const getTotalQuantity = () => {
    return selectedSizes.reduce((sum, item) => sum + item.quantity, 0);
  };

  const isSelected = (size: string) => {
    return selectedSizes.some(s => s.size === size);
  };

  const getQuantity = (size: string): number => {
    return selectedSizes.find(s => s.size === size)?.quantity || 1;
  };

  // 실제 비율을 유지하는 썸네일 컴포넌트
  const PanelThumbnail: React.FC<{ sizeInfo: PanelSizeInfo }> = ({ sizeInfo }) => {
    const maxSize = 80;
    const ratio = sizeInfo.availableWidth / sizeInfo.availableHeight;
    
    let displayWidth, displayHeight;
    if (ratio > 1) {
      displayWidth = maxSize;
      displayHeight = maxSize / ratio;
    } else {
      displayHeight = maxSize;
      displayWidth = maxSize * ratio;
    }
    
    return (
      <div className="flex justify-center mb-3">
        <div 
          className="border-2 border-border bg-muted relative rounded"
          style={{ 
            width: `${displayWidth}px`, 
            height: `${displayHeight}px`
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground font-medium">
            {sizeInfo.baseName}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold mb-2">판재 사이즈를 선택해 주세요</h3>
        <p className="text-muted-foreground">
          여러 사이즈를 선택하고 각각의 수량을 설정할 수 있습니다
        </p>
      </div>

      {/* 선택된 사이즈 요약 */}
      {selectedSizes.length > 0 && (
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                <span className="font-semibold">선택된 사이즈</span>
                <Badge variant="default">{selectedSizes.length}개</Badge>
              </div>
              <div className="text-sm font-medium">
                총 수량: <span className="text-primary text-lg">{getTotalQuantity()}</span>EA
              </div>
            </div>
            
            <div className="space-y-2">
              {selectedSizes.map(({ size, quantity }) => {
                const sizeInfo = getPanelSizeInfo(size);
                return (
                  <div 
                    key={size}
                    className="flex items-center justify-between p-3 bg-background/80 rounded-lg border border-border/50"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{sizeInfo.baseName}</div>
                      <div className="text-xs text-muted-foreground">
                        {sizeInfo.availableWidth}×{sizeInfo.availableHeight}mm
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleQuantityChange(size, quantity - 1)}
                          disabled={quantity <= 1}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={(e) => handleQuantityChange(size, parseInt(e.target.value) || 1)}
                          className="w-16 text-center font-medium"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleQuantityChange(size, quantity + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemove(size)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 사이즈 선택 그리드 */}
      {availableSizes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableSizes.map((size) => {
            const sizeInfo = getPanelSizeInfo(size);
            const selected = isSelected(size);
            
            return (
              <Card
                key={size}
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                  selected 
                    ? 'border-2 border-primary bg-primary/5 shadow-md' 
                    : 'border-2 border-border/50 hover:border-primary/30'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => handleSizeToggle(size)}
                      className="mt-1"
                    />
                    
                    <div 
                      className="flex-1"
                      onClick={() => handleSizeToggle(size)}
                    >
                      <PanelThumbnail sizeInfo={sizeInfo} />
                      <div className="text-center space-y-1">
                        <div className="font-semibold text-base">
                          {sizeInfo.baseName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <div>기준: {sizeInfo.baseWidth}×{sizeInfo.baseHeight}mm</div>
                          <div className="font-medium text-primary">
                            가용: {sizeInfo.availableWidth}×{sizeInfo.availableHeight}mm
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          두께: {selectedThickness || 'N/A'}
                        </div>
                        {selected && (
                          <Badge variant="default" className="mt-2">
                            {getQuantity(size)}EA 선택됨
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-muted/50 rounded-xl border-2 border-border/50">
          <div className="text-muted-foreground text-lg mb-2 font-medium">
            사용 가능한 사이즈가 없습니다
          </div>
          <p className="text-muted-foreground/70">다른 두께를 선택해주세요</p>
        </div>
      )}

      {/* 다음 단계 버튼 */}
      {selectedSizes.length > 0 && (
        <div className="pt-4">
          <Button
            onClick={onNext}
            size="lg"
            className="w-full text-base font-semibold"
          >
            다음 단계로 ({getTotalQuantity()}EA)
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default MultipleSizeSelection;
