import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ChevronDown, 
  ChevronUp, 
  Settings2, 
  Info,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAdvancedProcessingSettings } from "@/hooks/useAdvancedProcessingSettings";

interface AdvancedProcessingOptionsProps {
  qty?: number;
  onQtyChange?: (qty: number) => void;
  
  isComplex?: boolean;
  onComplexChange?: (isComplex: boolean) => void;
  
  bevelLengthM?: number;
  onBevelLengthChange?: (length: number) => void;
  
  laserHoles?: number;
  onLaserHolesChange?: (holes: number) => void;
  
}

const AdvancedProcessingOptions = ({
  qty = 1,
  onQtyChange,
  isComplex = false,
  onComplexChange,
  bevelLengthM = 0,
  onBevelLengthChange,
  laserHoles = 0,
  onLaserHolesChange,
}: AdvancedProcessingOptionsProps) => {
  const [isOpen, setIsOpen] = React.useState(true);
  const { getSettingValue } = useAdvancedProcessingSettings();
  
  // DB에서 단가 가져오기
  const bevelCostPerM = getSettingValue('bevel_cost_per_m');
  const laserHoleCost = getSettingValue('laser_hole_cost');

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-6">
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-background to-muted/30">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-3">
                <Settings2 className="w-5 h-5 text-primary" />
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  계산 세부 조건
                </span>
                <Badge variant="secondary" className="text-xs">
                  단순 보정
                </Badge>
              </div>
              {isOpen ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-6 space-y-6">
            {/* 기본 옵션 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="qty" className="text-sm font-semibold flex items-center gap-2">
                  수량 (EA)
                  <Info className="w-4 h-4 text-muted-foreground" />
                </Label>
                <Input
                  id="qty"
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => onQtyChange?.(parseInt(e.target.value) || 1)}
                  className="font-medium"
                />
              </div>
            </div>

            {/* 모양 복잡도 */}
            <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
              <Checkbox
                id="isComplex"
                checked={isComplex}
                onCheckedChange={(checked) => onComplexChange?.(checked as boolean)}
              />
              <Label
                htmlFor="isComplex"
                className="text-sm font-medium cursor-pointer flex-1"
              >
                복잡한 모양 (슬릿, 다공 등)
                <p className="text-xs text-muted-foreground mt-1">
                  복잡도에 따라 레이저 complex 또는 CNC complex 가공이 선택됩니다
                </p>
              </Label>
            </div>

            <Separator />

            {/* 추가 가공 옵션 */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm">추가 가공 옵션</h4>
              
              {/* 45도 베벨 */}
              <div className="space-y-2">
                <Label htmlFor="bevelLength" className="text-sm font-semibold flex items-center gap-2">
                  45° 베벨 길이 (m)
                  <Badge variant="outline" className="text-xs">
                    {bevelCostPerM.toLocaleString()}원/m
                  </Badge>
                </Label>
                <Input
                  id="bevelLength"
                  type="number"
                  min="0"
                  step="0.1"
                  value={bevelLengthM || ''}
                  onChange={(e) => onBevelLengthChange?.(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="font-medium"
                />
              </div>

              {/* 레이저 타공 */}
              <div className="space-y-2">
                <Label htmlFor="laserHoles" className="text-sm font-semibold flex items-center gap-2">
                  레이저 타공 개수
                  <Badge variant="outline" className="text-xs">
                    {laserHoleCost.toLocaleString()}원/개
                  </Badge>
                </Label>
                <Input
                  id="laserHoles"
                  type="number"
                  min="0"
                  value={laserHoles || ''}
                  onChange={(e) => onLaserHolesChange?.(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="font-medium"
                />
              </div>

            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default AdvancedProcessingOptions;
