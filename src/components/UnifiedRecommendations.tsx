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
  offcut?: {
    largestReusableRect: { width: number; height: number; area: number };
    scrapArea: number;
    reusableArea: number;
  };
  score?: number;
}

interface PanelUsage {
  panelName: string;
  quantity: number;
  placedItems: Array<{ itemId: string; count: number }>;
  efficiency: number;
  positions?: Array<{ x: number; y: number; width: number; height: number; rotated: boolean; itemId: string }>;
  offcut?: {
    largestReusableRect: { width: number; height: number; area: number };
    scrapArea: number;
    reusableArea: number;
  };
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

export interface YieldRecommendationSnapshot {
  source: 'yield-calculator';
  recommendationType: 'single' | 'combination';
  quality: string;
  thickness: string;
  generatedAt: string;
  cutItems: Array<{ id: string; width: string; height: string; quantity: string }>;
  efficiency: number;
  panelsNeeded: number;
  wasteArea: number;
  totalCost?: number;
  largestReusableRect?: { width: number; height: number; area: number } | null;
  panels: Array<{
    size: string;
    quantity: number;
    width?: number;
    height?: number;
    efficiency?: number;
    placedItems?: Array<{ itemId: string; count: number }>;
    largestReusableRect?: { width: number; height: number; area: number } | null;
  }>;
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
    panels?: Array<{ size: string; quantity: number }>;
    yieldRecommendation?: YieldRecommendationSnapshot;
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
    .sort((a, b) => {
      if (a.panelsNeeded !== b.panelsNeeded) return a.panelsNeeded - b.panelsNeeded;
      if (Math.abs(a.wasteArea - b.wasteArea) > 1000) return a.wasteArea - b.wasteArea;
      return b.efficiency - a.efficiency;
    })
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

  const createYieldRecommendationSnapshot = (recommendation: UnifiedRecommendation): YieldRecommendationSnapshot => {
    if (recommendation.type === 'single') {
      const data = recommendation.data as YieldResult;
      return {
        source: 'yield-calculator',
        recommendationType: 'single',
        quality: selectedQuality,
        thickness: selectedThickness,
        generatedAt: new Date().toISOString(),
        cutItems: cutItems.map(item => ({ ...item })),
        efficiency: data.efficiency,
        panelsNeeded: data.panelsNeeded,
        wasteArea: data.wasteArea,
        largestReusableRect: data.offcut?.largestReusableRect || null,
        panels: [{
          size: data.panelSize,
          quantity: data.panelsNeeded,
          width: data.panelWidth,
          height: data.panelHeight,
          efficiency: data.efficiency,
          largestReusableRect: data.offcut?.largestReusableRect || null,
        }],
      };
    }

    const data = recommendation.data as CombinationResult;
    const largestReusableRect = data.panels
      .map(panel => panel.offcut?.largestReusableRect)
      .filter(Boolean)
      .sort((a, b) => (b?.area || 0) - (a?.area || 0))[0] || null;

    return {
      source: 'yield-calculator',
      recommendationType: 'combination',
      quality: selectedQuality,
      thickness: selectedThickness,
      generatedAt: new Date().toISOString(),
      cutItems: cutItems.map(item => ({ ...item })),
      efficiency: data.totalEfficiency,
      panelsNeeded: data.panels.reduce((sum, panel) => sum + panel.quantity, 0),
      wasteArea: data.totalWasteArea,
      totalCost: data.totalCost,
      largestReusableRect,
      panels: data.panels.map(panel => {
        const panelInfo = availablePanelSizes.find(p => p.name === panel.panelName);
        return {
          size: panel.panelName,
          quantity: panel.quantity,
          width: panelInfo?.width,
          height: panelInfo?.height,
          efficiency: panel.efficiency,
          placedItems: panel.placedItems.map(item => ({ ...item })),
          largestReusableRect: panel.offcut?.largestReusableRect || null,
        };
      }),
    };
  };

  const applyRecommendationToQuote = (recommendation: UnifiedRecommendation) => {
    if (!onPanelSelect) return;

    const yieldRecommendation = createYieldRecommendationSnapshot(recommendation);

    if (recommendation.type === 'single') {
      const data = recommendation.data as YieldResult;
      onPanelSelect({
        quality: selectedQuality,
        thickness: selectedThickness,
        size: data.panelSize,
        quantity: data.panelsNeeded,
        yieldRecommendation,
      });
      return;
    }

    const data = recommendation.data as CombinationResult;
    const panels = data.panels.map(panel => ({
      size: panel.panelName,
      quantity: panel.quantity,
    }));
    onPanelSelect({
      quality: selectedQuality,
      thickness: selectedThickness,
      size: panels[0]?.size || '',
      quantity: panels[0]?.quantity || 1,
      panels,
      yieldRecommendation,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5" />
              잔재 최소화 추천
            </div>
            {onPanelSelect && (
              <p className="mt-1 text-xs font-normal text-muted-foreground">
                추천안을 적용하면 색상 선택 단계로 이동하며 원판 수량과 수율 근거가 견적에 저장됩니다.
              </p>
            )}
          </div>
          {onPanelSelect && unifiedRecommendations[0] && (
            <Button
              variant="default"
              size="sm"
              onClick={() => applyRecommendationToQuote(unifiedRecommendations[0])}
              className="animate-fade-in"
            >
              최적 추천안 적용
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
                      추천
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
                        <div className="text-muted-foreground">잔재면적</div>
                        <div className="font-medium">
                          {(recommendation.wasteArea / 1000000).toFixed(2)}㎡
                        </div>
                      </div>
                    </div>
                    {(recommendation.data as YieldResult).offcut?.largestReusableRect.area ? (
                      <div className="mt-3 rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
                        재활용 가능 잔재 최대 {(recommendation.data as YieldResult).offcut!.largestReusableRect.width.toFixed(0)}
                        ×{(recommendation.data as YieldResult).offcut!.largestReusableRect.height.toFixed(0)}mm
                      </div>
                    ) : null}
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
                            return sum + panel.placedItems.reduce((itemSum, item) => itemSum + item.count, 0);
                          }, 0)}개
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">원판 수량</div>
                        <div className="font-medium">{recommendation.panelsNeeded}장</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">잔재면적</div>
                        <div className="font-medium">
                          {(recommendation.wasteArea / 1000000).toFixed(2)}㎡
                        </div>
                      </div>
                    </div>
                    {(() => {
                      const largest = (recommendation.data as CombinationResult).panels
                        .map(panel => panel.offcut?.largestReusableRect)
                        .filter(Boolean)
                        .sort((a, b) => (b?.area || 0) - (a?.area || 0))[0];
                      return largest?.area ? (
                        <div className="mt-3 rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
                          재활용 가능 잔재 최대 {largest.width.toFixed(0)}×{largest.height.toFixed(0)}mm
                        </div>
                      ) : null;
                    })()}
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
                      const placedCount = panel.placedItems.reduce((itemSum, item) => itemSum + item.count, 0);
                      return sum + placedCount;
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
                    selectedThickness={selectedThickness}
                  />
                ) : (
                  <CombinationThumbnail
                    panelUsages={(recommendation.data as CombinationResult).panels}
                    cutItems={cutItems}
                    availablePanelSizes={availablePanelSizes}
                    selectedThickness={selectedThickness}
                  />
                )}
                {onPanelSelect && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyRecommendationToQuote(recommendation)}
                    className="whitespace-nowrap"
                  >
                    이 안으로 적용
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
