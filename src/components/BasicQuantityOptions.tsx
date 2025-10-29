import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Package, Settings, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface BasicQuantityOptionsProps {
  qty: number;
  onQtyChange: (qty: number) => void;
  isComplex: boolean;
  onComplexChange: (isComplex: boolean) => void;
  onNext: () => void;
}

const BasicQuantityOptions = ({
  qty,
  onQtyChange,
  isComplex,
  onComplexChange,
  onNext,
}: BasicQuantityOptionsProps) => {
  return (
    <Card className="border-border/50 shadow-smooth animate-fade-up">
      <CardHeader className="text-center pb-6 border-b border-border/50">
        <CardTitle className="flex items-center justify-center gap-3">
          <Package className="w-6 h-6 text-primary" />
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            수량 및 복잡도 선택
          </span>
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          제작할 판재의 수량과 가공 복잡도를 선택하세요
        </p>
      </CardHeader>
      
      <CardContent className="pt-8 space-y-6">
        {/* 수량 입력 */}
        <div className="space-y-3">
          <Label htmlFor="qty" className="text-base font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            수량 (EA)
          </Label>
          <Input
            id="qty"
            type="number"
            min="1"
            value={qty}
            onChange={(e) => onQtyChange(parseInt(e.target.value) || 1)}
            className="text-lg font-medium h-12"
            placeholder="수량을 입력하세요"
          />
          <p className="text-xs text-muted-foreground">
            여러 장을 제작하는 경우 수량을 입력하세요
          </p>
        </div>

        {/* 복잡도 선택 */}
        <div className="p-5 bg-gradient-to-br from-muted/50 to-muted/30 rounded-lg border-2 border-border/50 hover:border-primary/30 transition-colors">
          <div className="flex items-start space-x-4">
            <Checkbox
              id="isComplex"
              checked={isComplex}
              onCheckedChange={(checked) => onComplexChange(checked as boolean)}
              className="mt-1"
            />
            <div className="flex-1 space-y-2">
              <Label
                htmlFor="isComplex"
                className="text-base font-semibold cursor-pointer flex items-center gap-2"
              >
                <Settings className="w-5 h-5 text-primary" />
                복잡한 모양 가공
                {isComplex && (
                  <Badge variant="default" className="ml-2">
                    선택됨
                  </Badge>
                )}
              </Label>
              <p className="text-sm text-muted-foreground leading-relaxed">
                슬릿, 다공, 복잡한 형상 등의 고급 가공이 필요한 경우 선택하세요.
                <br />
                <span className="text-xs">
                  선택 시 레이저 complex 또는 CNC complex 가공으로 자동 분류됩니다.
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* 다음 단계 버튼 */}
        <div className="pt-4">
          <Button
            onClick={onNext}
            size="lg"
            className="w-full text-base font-semibold"
          >
            다음 단계로
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>

        {/* 안내 정보 */}
        <div className="text-xs text-muted-foreground bg-primary/5 p-4 rounded-lg border border-primary/10">
          <p className="font-semibold mb-2 text-primary">💡 참고사항</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>수량이 많을수록 단가가 낮아질 수 있습니다</li>
            <li>복잡한 모양은 가공 비용이 추가됩니다</li>
            <li>다음 단계에서 구체적인 가공 방법을 선택할 수 있습니다</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default BasicQuantityOptions;
