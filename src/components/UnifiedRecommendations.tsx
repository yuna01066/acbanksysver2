import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Package, Layers } from "lucide-react";
import NestingThumbnail from "@/components/NestingThumbnail";
import CombinationThumbnail from "@/components/CombinationThumbnail";
import { UnifiedResult } from "@/utils/unifiedPanelCalculator";

interface UnifiedRecommendationsProps {
  unifiedResults: UnifiedResult[];
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
  totalQuantity: number;
  bestSingleRecommendation?: UnifiedResult;
}

const UnifiedRecommendations: React.FC<UnifiedRecommendationsProps> = ({
  unifiedResults,
  cutItems,
  onPanelSelect,
  selectedQuality,
  selectedThickness,
  availablePanelSizes,
  totalQuantity,
  bestSingleRecommendation
}) => {
  if (unifiedResults.length === 0) {
    return null;
  }

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
                size: bestSingleRecommendation.panelSize!,
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
        {unifiedResults.map((recommendation, index) => (
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
                    {recommendation.totalEfficiency.toFixed(1)}%
                  </span>
                </div>

                {recommendation.type === 'single' ? (
                  <NestingThumbnail
                    cutItems={cutItems}
                    panelWidth={recommendation.panelWidth!}
                    panelHeight={recommendation.panelHeight!}
                    panelsNeeded={recommendation.panelsNeeded}
                  />
                ) : (
                  <CombinationThumbnail
                    panelUsages={recommendation.panels}
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