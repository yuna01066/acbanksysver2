import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Package } from "lucide-react";

interface PanelUsage {
  panelName: string;
  quantity: number;
  placedItems: Array<{ itemId: string; count: number }>;
  efficiency: number;
}

interface CombinationResult {
  panels: PanelUsage[];
  totalEfficiency: number;
  totalWasteArea: number;
  totalCost: number;
  allItemsPlaced: boolean;
  remainingItems: Array<{ itemId: string; remaining: number }>;
}

interface PanelCombinationResultProps {
  combinations: CombinationResult[];
  cutItems: Array<{ id: string; width: string; height: string; quantity: string }>;
  onPanelSelect?: (panelData: {
    quality: string;
    thickness: string;
    size: string;
    quantity: number;
  }) => void;
  selectedQuality: string;
  selectedThickness: string;
}

const PanelCombinationResult: React.FC<PanelCombinationResultProps> = ({
  combinations,
  cutItems,
  onPanelSelect,
  selectedQuality,
  selectedThickness
}) => {
  const totalQuantity = cutItems.reduce((sum, item) => {
    const qty = parseInt(item.quantity) || 0;
    return sum + qty;
  }, 0);

  const getItemName = (itemId: string) => {
    const index = parseInt(itemId.replace('item-', ''));
    return `도형 ${index + 1}`;
  };

  const handleSelectCombination = (combination: CombinationResult) => {
    if (onPanelSelect && combination.panels.length > 0) {
      // 첫 번째 판만 선택 (향후 여러 판 선택 기능 확장 가능)
      const firstPanel = combination.panels[0];
      onPanelSelect({
        quality: selectedQuality,
        thickness: selectedThickness,
        size: firstPanel.panelName,
        quantity: firstPanel.quantity
      });
    }
  };

  if (combinations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-title flex items-center gap-2">
          <Package className="w-5 h-5" />
          복합 원판 조합 추천
        </CardTitle>
        <p className="text-body text-muted-foreground">
          여러 원판을 조합하여 더 효율적인 배치를 찾았습니다
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {combinations.slice(0, 5).map((combination, index) => (
            <div 
              key={index}
              className={`p-4 rounded-xl border transition-all duration-200 ${
                index === 0 && combination.allItemsPlaced
                  ? 'border-primary/30 bg-primary/5 shadow-smooth' 
                  : 'border-border/50 bg-background/50'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold">
                      조합 {index + 1}
                      {index === 0 && combination.allItemsPlaced && (
                        <Badge variant="default" className="ml-2">
                          <Star className="w-3 h-3 mr-1" />
                          최적
                        </Badge>
                      )}
                    </h4>
                    <div className="flex gap-2">
                      {combination.panels.map((panel, panelIndex) => (
                        <Badge key={panelIndex} variant="outline">
                          {panel.panelName} {panel.quantity}장
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                    <div>
                      <div className="text-muted-foreground">총 필요 수량</div>
                      <div className="font-medium">{totalQuantity}개</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">총 판 수</div>
                      <div className="font-medium">
                        {combination.panels.reduce((sum, panel) => sum + panel.quantity, 0)}장
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">평균 수율</div>
                      <div className="font-medium">{combination.totalEfficiency.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">총 폐기면적</div>
                      <div className="font-medium">
                        {(combination.totalWasteArea / 1000000).toFixed(2)}㎡
                      </div>
                    </div>
                  </div>

                  {/* 각 원판별 배치 정보 */}
                  <div className="space-y-2">
                    {combination.panels.map((panel, panelIndex) => (
                      <div key={panelIndex} className="bg-muted/30 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">
                            {panel.panelName} 원판 ({panel.quantity}장)
                          </span>
                          <span className="text-xs text-muted-foreground">
                            수율 {panel.efficiency.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {panel.placedItems.map((item, itemIndex) => (
                            <Badge key={itemIndex} variant="secondary" className="text-xs">
                              {getItemName(item.itemId)} {item.count}개
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center gap-3 ml-4">
                  {combination.allItemsPlaced ? (
                    <div className="text-right">
                      <div className="text-xs text-success font-medium">
                        ✓ 완료
                      </div>
                    </div>
                  ) : (
                    <div className="text-right">
                      <div className="text-xs text-warning font-medium">
                        일부 미배치
                      </div>
                    </div>
                  )}
                  
                  {onPanelSelect && (
                    <Button
                      variant="minimal"
                      size="sm"
                      onClick={() => handleSelectCombination(combination)}
                      className="whitespace-nowrap"
                    >
                      선택
                    </Button>
                  )}
                </div>
              </div>
              
              {!combination.allItemsPlaced && combination.remainingItems.length > 0 && (
                <div className="mt-3 p-2 bg-warning/10 text-muted-foreground text-sm rounded-lg">
                  <span className="font-medium">미배치 도형:</span> 
                  {combination.remainingItems.map((item, idx) => (
                    <span key={idx}>
                      {idx > 0 && ', '}
                      {getItemName(item.itemId)} {item.remaining}개
                    </span>
                  ))}
                </div>
              )}
              
              {combination.allItemsPlaced && (
                <div className="mt-3 p-2 bg-success/10 text-muted-foreground text-sm rounded-lg">
                  <span className="font-medium">완벽한 배치:</span> 
                  모든 도형이 성공적으로 배치되었습니다
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default PanelCombinationResult;