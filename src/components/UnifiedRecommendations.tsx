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

  // 모든 추천안을 통합하고 효율성 순으로 정렬 (모든 도형이 배치된 경우만)
  const allRecommendations: UnifiedRecommendation[] = [
    // 단일 원판 결과들 (모든 도형이 배치된 경우만)
    ...yieldResults
      .filter(result => result.efficiency > 0) // 효율이 0인 경우 제외
      .map(result => ({
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
    // 복합 원판 조합 결과들 (모든 아이템이 배치된 경우만)
    ...combinations
      .filter(combination => combination.allItemsPlaced) // 모든 아이템이 배치된 경우만
      .map(combination => ({
        type: 'combination' as const,
        efficiency: combination.totalEfficiency,
        panelsNeeded: combination.panels.reduce((sum, panel) => sum + panel.quantity, 0),
        wasteArea: combination.totalWasteArea,
        totalCost: combination.totalCost,
        data: combination
      }))
  ];

  // 중복 제거: 같은 효율성(±0.5%)과 비슷한 패널 수를 가진 추천안들 중에서 더 나은 것만 선택
  const unifiedRecommendations = allRecommendations
    .sort((a, b) => b.efficiency - a.efficiency) // 효율성 내림차순 정렬
    .filter((recommendation, index, array) => {
      // 첫 번째는 항상 포함
      if (index === 0) return true;
      
      // 이전 추천안들과 비교하여 중복 체크
      const isDuplicate = array.slice(0, index).some(prev => {
        // 효율성이 비슷한지 체크 (±0.5% 범위)
        const efficiencyDiff = Math.abs(prev.efficiency - recommendation.efficiency);
        const similarEfficiency = efficiencyDiff <= 0.5;
        
        // 패널 수가 같은지 체크
        const samePanelCount = prev.panelsNeeded === recommendation.panelsNeeded;
        
        // 효율성과 패널 수가 비슷하면 중복으로 간주
        if (similarEfficiency && samePanelCount) {
          // 단일 조합을 우선시 (더 간단하므로)
          return recommendation.type === 'combination' && prev.type === 'single';
        }
        
        return false;
      });
      
      return !isDuplicate;
    });

  if (unifiedRecommendations.length === 0) {
    return null;
  }

  // 최적 추천안 선택 (가장 높은 효율의 단일 원판)
  const bestSingleRecommendation = unifiedRecommendations.find(rec => rec.type === 'single');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            효율성 순 추천
          </div>
          {onPanelSelect && bestSingleRecommendation && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onPanelSelect({
                quality: selectedQuality,
                thickness: selectedThickness,
                size: (bestSingleRecommendation.data as YieldResult).panelSize,
                quantity: bestSingleRecommendation.panelsNeeded
              })}
              className="animate-fade-in"
            >
              견적계산기로
            </Button>
          )}
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
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-lg font-medium">
                          {(recommendation.data as YieldResult).panelSize}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          가용사이즈: {(recommendation.data as YieldResult).panelWidth}×{(recommendation.data as YieldResult).panelHeight}mm
                        </div>
                      </div>
                      <div className="bg-muted px-2 py-1 rounded text-xs text-muted-foreground">
                        {recommendation.panelsNeeded}장 (효율: {recommendation.efficiency.toFixed(1)}%)
                      </div>
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
                    <div className="space-y-2 mb-3">
                      {(recommendation.data as CombinationResult).panels.map((panel, panelIndex) => {
                        const panelInfo = availablePanelSizes.find(p => p.name === panel.panelName);
                        return (
                          <div key={panelIndex} className="flex justify-between items-center">
                            <div>
                              <span className="text-lg font-medium">{panel.panelName}</span>
                              {panelInfo && (
                                <div className="text-xs text-muted-foreground">
                                  가용사이즈: {panelInfo.width}×{panelInfo.height}mm
                                </div>
                              )}
                            </div>
                            <div className="bg-muted px-2 py-1 rounded text-xs text-muted-foreground">
                              {panel.quantity}장 (효율: {panel.efficiency.toFixed(1)}%)
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">총 필요 수량</div>
                        <div className="font-medium">{totalQuantity}개</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">총 생산량</div>
                        <div className="font-medium">
                          {(recommendation.data as CombinationResult).panels.reduce((sum, panel) => {
                            return sum + panel.placedItems.reduce((itemSum, item) => itemSum + item.count, 0) * panel.quantity;
                          }, 0)}개
                        </div>
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
                )}

                {/* 여분 생산 정보 */}
                {recommendation.type === 'single' ? (
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
                ) : (
                  (() => {
                    // 복합 조합의 총 생산량 계산
                    const combinationData = recommendation.data as CombinationResult;
                    const totalProduced = combinationData.panels.reduce((sum, panel) => {
                      const panelSize = availablePanelSizes.find(p => p.name === panel.panelName);
                      if (!panelSize) return sum;
                      
                      // 이 패널에 배치된 총 아이템 수 계산
                      const placedCount = panel.placedItems.reduce((itemSum, item) => itemSum + item.count, 0);
                      return sum + (placedCount * panel.quantity);
                    }, 0);
                    
                    const surplus = totalProduced - totalQuantity;
                    
                    return (
                      <>
                        {surplus > 0 && (
                          <div className="mt-3 p-2 bg-warning/10 text-muted-foreground text-sm rounded-lg">
                            <span className="font-medium">여분 생산:</span> 
                            {surplus}개 추가 생산됩니다
                          </div>
                        )}
                        
                        {surplus === 0 && (
                          <div className="mt-3 p-2 bg-success/10 text-muted-foreground text-sm rounded-lg">
                            <span className="font-medium">정확한 수량:</span> 
                            여분 없이 정확히 {totalQuantity}개 생산됩니다
                          </div>
                        )}
                      </>
                    );
                  })()
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
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default UnifiedRecommendations;