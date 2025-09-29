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
      <CardContent className="space-y-3">
        {unifiedRecommendations.map((recommendation, index) => (
          <div 
            key={index} 
            className={`
              border rounded-xl p-5 transition-all duration-200 hover:shadow-md
              ${index === 0 ? 'border-primary/20 bg-primary/5' : 'border-border hover:border-primary/30'}
            `}
          >
            {/* 헤더 섹션 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {index === 0 && (
                  <Badge variant="default" className="text-xs animate-fade-in">
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
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">
                  {recommendation.efficiency.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">효율성</div>
              </div>
            </div>

            {/* 메인 콘텐츠 */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,120px] gap-6 items-start">
              {/* 정보 섹션 */}
              <div className="space-y-4">
                {/* 제목 */}
                <div className="text-lg font-semibold text-foreground">
                  {recommendation.type === 'single' 
                    ? (recommendation.data as YieldResult).panelSize
                    : `복합 원판 조합 (${(recommendation.data as CombinationResult).panels.length}종류)`
                  }
                </div>

                {/* 복합 조합의 세부 패널 정보 */}
                {recommendation.type === 'combination' && (
                  <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                    {(recommendation.data as CombinationResult).panels.map((panel, panelIndex) => (
                      <div key={panelIndex} className="flex justify-between items-center text-sm">
                        <span className="font-medium">{panel.panelName}</span>
                        <div className="text-right">
                          <div className="font-medium">{panel.quantity}장</div>
                          <div className="text-xs text-muted-foreground">효율: {panel.efficiency.toFixed(1)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 통계 정보 그리드 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted/20 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">필요 수량</div>
                    <div className="text-lg font-semibold">{totalQuantity}개</div>
                  </div>
                  
                  {recommendation.type === 'single' && (
                    <div className="text-center p-3 bg-muted/20 rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">생산량</div>
                      <div className="text-lg font-semibold">{(recommendation.data as YieldResult).totalPieces}개</div>
                    </div>
                  )}
                  
                  <div className="text-center p-3 bg-muted/20 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">원판 수량</div>
                    <div className="text-lg font-semibold">{recommendation.panelsNeeded}장</div>
                  </div>
                  
                  <div className="text-center p-3 bg-muted/20 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">폐기면적</div>
                    <div className="text-lg font-semibold">
                      {(recommendation.wasteArea / 1000000).toFixed(2)}㎡
                    </div>
                  </div>
                  
                  {recommendation.totalCost && (
                    <div className="text-center p-3 bg-muted/20 rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">예상 비용</div>
                      <div className="text-lg font-semibold">
                        {recommendation.totalCost.toLocaleString()}원
                      </div>
                    </div>
                  )}
                </div>

                {/* 여분 생산 정보 */}
                {recommendation.type === 'single' && (
                  <div className="mt-3">
                    {(recommendation.data as YieldResult).surplus > 0 ? (
                      <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                        <Package className="w-4 h-4 text-warning" />
                        <span className="text-sm">
                          <span className="font-medium">여분 생산:</span> {(recommendation.data as YieldResult).surplus}개 추가 생산됩니다
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg">
                        <Star className="w-4 h-4 text-success" />
                        <span className="text-sm">
                          <span className="font-medium">정확한 수량:</span> 여분 없이 정확히 {totalQuantity}개 생산됩니다
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 썸네일 섹션 */}
              <div className="flex justify-center lg:justify-end">
                <div className="shrink-0">
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
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default UnifiedRecommendations;