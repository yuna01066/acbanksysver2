import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Package, Layers } from "lucide-react";
import NestingThumbnail from "@/components/NestingThumbnail";
import CombinationThumbnail from "@/components/CombinationThumbnail";

interface YieldResult {
  panelSize: string;
  panelWidth: number;
  panelHeight: number;
  piecesPerPanel: number;
  panelsNeeded: number;
  totalPieces: number;
  efficiency: number;
  wasteArea: number;
  surplus: number;
}

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

interface UnifiedRecommendation {
  type: 'single' | 'combination';
  efficiency: number;
  panelsNeeded: number;
  wasteArea: number;
  totalCost?: number;
  data: YieldResult | CombinationResult;
  panelInfo?: { panelSize: string; panelWidth: number; panelHeight: number };
}

interface UnifiedRecommendationsProps {
  yieldResults: YieldResult[];
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
  availablePanelSizes: Array<{ name: string; width: number; height: number }>;
}

const UnifiedRecommendations: React.FC<UnifiedRecommendationsProps> = ({
  yieldResults,
  combinations,
  cutItems,
  onPanelSelect,
  selectedQuality,
  selectedThickness,
  availablePanelSizes
}) => {
  const totalQuantity = cutItems.reduce((sum, item) => 
    sum + (item.quantity ? parseInt(item.quantity) : 0), 0
  );

  // 모든 추천안을 통합하고 효율성 순으로 정렬
  const unifiedRecommendations: UnifiedRecommendation[] = [
    // 단일 원판 결과들
    ...yieldResults.map(result => ({
      type: 'single' as const,
      efficiency: result.efficiency,
      panelsNeeded: result.panelsNeeded,
      wasteArea: result.wasteArea,
      data: result,
      panelInfo: {
        panelSize: result.panelSize,
        panelWidth: result.panelWidth,
        panelHeight: result.panelHeight
      }
    })),
    // 복합 원판 조합 결과들
    ...combinations.map(combination => ({
      type: 'combination' as const,
      efficiency: combination.totalEfficiency,
      panelsNeeded: combination.panels.reduce((sum, panel) => sum + panel.quantity, 0),
      wasteArea: combination.totalWasteArea,
      totalCost: combination.totalCost,
      data: combination
    }))
  ].sort((a, b) => b.efficiency - a.efficiency); // 효율성 내림차순 정렬

  if (unifiedRecommendations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="w-5 h-5" />
          효율성 순 추천
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {unifiedRecommendations.map((recommendation, index) => (
          <div key={index} className="border border-border rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  {index === 0 && (
                    <Badge variant="default" className="text-xs">
                      <Star className="w-3 h-3 mr-1" />
                      최고 효율
                    </Badge>
                  )}
                  <Badge variant={recommendation.type === 'single' ? 'secondary' : 'outline'}>
                    {recommendation.type === 'single' ? (
                      <>
                        <Package className="w-3 h-3 mr-1" />
                        단일 원판
                      </>
                    ) : (
                      <>
                        <Layers className="w-3 h-3 mr-1" />
                        복합 조합
                      </>
                    )}
                  </Badge>
                  <span className="text-lg font-semibold text-primary">
                    {recommendation.efficiency.toFixed(1)}%
                  </span>
                </div>

                {recommendation.type === 'single' ? (
                  <div>
                    <div className="text-lg font-medium mb-2">
                      {(recommendation.data as YieldResult).panelSize}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">총 필요 수량</div>
                        <div className="font-medium">{totalQuantity}개</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">총 생산량</div>
                        <div className="font-medium">{(recommendation.data as YieldResult).totalPieces}개</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">원판 수량</div>
                        <div className="font-medium">{recommendation.panelsNeeded}장</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">폐기면적</div>
                        <div className="font-medium">
                          {(recommendation.wasteArea / 1000000).toFixed(2)}㎡
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-lg font-medium mb-2">
                      복합 원판 조합 ({(recommendation.data as CombinationResult).panels.length}종류)
                    </div>
                    <div className="space-y-2 mb-3">
                      {(recommendation.data as CombinationResult).panels.map((panel, panelIndex) => (
                        <div key={panelIndex} className="flex justify-between text-sm">
                          <span>{panel.panelName}</span>
                          <span>{panel.quantity}장 (효율: {panel.efficiency.toFixed(1)}%)</span>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">총 필요 수량</div>
                        <div className="font-medium">{totalQuantity}개</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">총 원판 수량</div>
                        <div className="font-medium">{recommendation.panelsNeeded}장</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">총 폐기면적</div>
                        <div className="font-medium">
                          {(recommendation.wasteArea / 1000000).toFixed(2)}㎡
                        </div>
                      </div>
                      {recommendation.totalCost && (
                        <div>
                          <div className="text-muted-foreground">예상 비용</div>
                          <div className="font-medium">
                            {recommendation.totalCost.toLocaleString()}원
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 여분 생산 정보 */}
                {recommendation.type === 'single' && (
                  <>
                    {(recommendation.data as YieldResult).surplus > 0 && (
                      <div className="mt-3 p-2 bg-warning/10 text-muted-foreground text-sm rounded-lg">
                        <span className="font-medium">여분 생산:</span> 
                        {(recommendation.data as YieldResult).surplus}개 추가 생산됩니다
                      </div>
                    )}
                    
                    {(recommendation.data as YieldResult).surplus === 0 && (
                      <div className="mt-3 p-2 bg-success/10 text-muted-foreground text-sm rounded-lg">
                        <span className="font-medium">정확한 수량:</span> 
                        여분 없이 정확히 {totalQuantity}개 생산됩니다
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 썸네일 및 버튼 */}
              <div className="flex items-center gap-3">
                {recommendation.type === 'single' ? (
                  <NestingThumbnail
                    cutItems={cutItems}
                    panelWidth={(recommendation.data as YieldResult).panelWidth}
                    panelHeight={(recommendation.data as YieldResult).panelHeight}
                    panelsNeeded={(recommendation.data as YieldResult).panelsNeeded}
                  />
                ) : (
                  <CombinationThumbnail
                    panelUsages={(recommendation.data as CombinationResult).panels}
                    cutItems={cutItems}
                    availablePanelSizes={availablePanelSizes}
                  />
                )}
                
                {onPanelSelect && recommendation.type === 'single' && (
                  <Button
                    variant="minimal"
                    size="sm"
                    onClick={() => onPanelSelect({
                      quality: selectedQuality,
                      thickness: selectedThickness,
                      size: (recommendation.data as YieldResult).panelSize,
                      quantity: recommendation.panelsNeeded
                    })}
                    className="whitespace-nowrap"
                  >
                    견적계산기로
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default UnifiedRecommendations;