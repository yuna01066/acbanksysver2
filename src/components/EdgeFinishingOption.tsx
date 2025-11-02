import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EdgeFinishingOptionProps {
  edgeFinishing?: boolean;
  onEdgeFinishingChange?: (enabled: boolean) => void;
}

const EdgeFinishingOption = ({
  edgeFinishing = false,
  onEdgeFinishingChange,
}: EdgeFinishingOptionProps) => {
  return (
    <Card className="mt-6 border-2 border-amber-200 dark:border-amber-900 bg-gradient-to-br from-amber-50/50 to-background dark:from-amber-950/20 dark:to-background">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-lg">
          <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <span className="bg-gradient-to-r from-amber-600 to-amber-500 bg-clip-text text-transparent">
            추가 옵션
          </span>
          <Badge variant="secondary" className="text-xs ml-auto">
            선택사항
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="flex items-start space-x-3 p-4 bg-background/80 rounded-lg border-2 border-amber-200 dark:border-amber-800 hover:border-amber-300 dark:hover:border-amber-700 transition-colors">
          <Checkbox
            id="edgeFinishing"
            checked={edgeFinishing}
            onCheckedChange={(checked) => onEdgeFinishingChange?.(checked as boolean)}
            className="mt-1"
          />
          <Label
            htmlFor="edgeFinishing"
            className="text-sm font-medium cursor-pointer flex-1 space-y-2"
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base">엣지 격면 마감</span>
              <Badge variant="outline" className="text-xs">
                고급 마감
              </Badge>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              엣지 연마 및 격면 마감 처리로 깔끔한 마감을 제공합니다
            </p>
            <div className="flex items-start gap-2 pt-1">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs space-y-1">
                <div className="text-amber-700 dark:text-amber-300 font-medium">
                  • 10T 이하: 자재비 증분 +80%
                </div>
                <div className="text-amber-700 dark:text-amber-300 font-medium">
                  • 10T 초과: 자재비 증분 +100%
                </div>
              </div>
            </div>
          </Label>
        </div>
      </CardContent>
    </Card>
  );
};

export default EdgeFinishingOption;
