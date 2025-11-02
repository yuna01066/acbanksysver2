import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  ChevronDown, 
  ChevronUp, 
  Settings2, 
  Info,
  Box,
  Square,
  Layers
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface AdvancedProcessingOptionsProps {
  qty?: number;
  onQtyChange?: (qty: number) => void;
  
  isComplex?: boolean;
  onComplexChange?: (isComplex: boolean) => void;
  
  bevelLengthM?: number;
  onBevelLengthChange?: (length: number) => void;
  
  laserHoles?: number;
  onLaserHolesChange?: (holes: number) => void;
  
  corners90?: number;
  onCorners90Change?: (corners: number) => void;
  
  useDetailedBond?: boolean;
  onDetailedBondChange?: (use: boolean) => void;
  
  joinLengthM?: number;
  onJoinLengthChange?: (length: number) => void;
  
  trayHeightMm?: number;
  onTrayHeightChange?: (height: number) => void;
}

type ProductType = 'flat' | 'tray' | 'box';

const AdvancedProcessingOptions = ({
  qty = 1,
  onQtyChange,
  isComplex = false,
  onComplexChange,
  bevelLengthM = 0,
  onBevelLengthChange,
  laserHoles = 0,
  onLaserHolesChange,
  corners90 = 0,
  onCorners90Change,
  useDetailedBond = false,
  onDetailedBondChange,
  joinLengthM = 0,
  onJoinLengthChange,
  trayHeightMm,
  onTrayHeightChange,
}: AdvancedProcessingOptionsProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [productType, setProductType] = React.useState<ProductType>('flat');
  
  // 박스/트레이 치수
  const [boxWidth, setBoxWidth] = React.useState<number>(0);
  const [boxLength, setBoxLength] = React.useState<number>(0);
  const [boxHeight, setBoxHeight] = React.useState<number>(0);
  
  // 박스 치수 기반 자동 계산
  React.useEffect(() => {
    if (productType === 'tray' && boxWidth > 0 && boxLength > 0 && boxHeight > 0) {
      // 트레이: 바닥 1면 + 측면 4면 (90도 접착)
      // 접착선 길이 = 바닥 둘레 + 측면 높이 4개
      const perimeterM = ((boxWidth + boxLength) * 2) / 1000;
      const heightTotalM = (boxHeight * 4) / 1000;
      const totalJoinM = perimeterM + heightTotalM;
      
      onJoinLengthChange?.(parseFloat(totalJoinM.toFixed(2)));
      onCorners90Change?.(4); // 4개의 모서리
      onTrayHeightChange?.(boxHeight);
    } else if (productType === 'box' && boxWidth > 0 && boxLength > 0 && boxHeight > 0) {
      // 박스: 6면 (상하좌우전후)
      // 접착선 길이 계산
      const edges = [
        boxWidth * 4,  // 가로 엣지 4개
        boxLength * 4, // 세로 엣지 4개
        boxHeight * 4  // 높이 엣지 4개
      ];
      const totalJoinMm = edges.reduce((sum, edge) => sum + edge, 0);
      onJoinLengthChange?.(parseFloat((totalJoinMm / 1000).toFixed(2)));
      onCorners90Change?.(8); // 8개의 꼭지점
      onTrayHeightChange?.(undefined);
    } else {
      // 평면
      onJoinLengthChange?.(0);
      onCorners90Change?.(0);
      onTrayHeightChange?.(undefined);
    }
  }, [productType, boxWidth, boxLength, boxHeight, onJoinLengthChange, onCorners90Change, onTrayHeightChange]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-6">
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-background to-muted/30">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-3">
                <Settings2 className="w-5 h-5 text-primary" />
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  고급 옵션
                </span>
                <Badge variant="secondary" className="text-xs">
                  선택사항
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
            {/* 제품 유형 선택 */}
            <div className="space-y-4">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Box className="w-5 h-5 text-primary" />
                제품 유형
              </Label>
              <RadioGroup value={productType} onValueChange={(value) => setProductType(value as ProductType)}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center space-x-2 p-4 border-2 rounded-lg hover:border-primary/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <RadioGroupItem value="flat" id="flat" />
                    <Label htmlFor="flat" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Square className="w-4 h-4" />
                      <div>
                        <div className="font-medium">평면</div>
                        <div className="text-xs text-muted-foreground">단일 패널</div>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-4 border-2 rounded-lg hover:border-primary/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <RadioGroupItem value="tray" id="tray" />
                    <Label htmlFor="tray" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Layers className="w-4 h-4" />
                      <div>
                        <div className="font-medium">트레이</div>
                        <div className="text-xs text-muted-foreground">5면 조립</div>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-4 border-2 rounded-lg hover:border-primary/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <RadioGroupItem value="box" id="box" />
                    <Label htmlFor="box" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Box className="w-4 h-4" />
                      <div>
                        <div className="font-medium">박스</div>
                        <div className="text-xs text-muted-foreground">6면 조립</div>
                      </div>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* 박스/트레이 치수 입력 */}
            {(productType === 'tray' || productType === 'box') && (
              <div className="p-4 border-2 border-primary/20 rounded-lg bg-primary/5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">
                    {productType === 'tray' ? '트레이' : '박스'} 치수 입력
                  </span>
                  <Badge variant="outline" className="text-xs ml-auto">
                    자동 계산
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="boxWidth" className="text-xs">가로 (mm)</Label>
                    <Input
                      id="boxWidth"
                      type="number"
                      min="0"
                      value={boxWidth || ''}
                      onChange={(e) => setBoxWidth(parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="boxLength" className="text-xs">세로 (mm)</Label>
                    <Input
                      id="boxLength"
                      type="number"
                      min="0"
                      value={boxLength || ''}
                      onChange={(e) => setBoxLength(parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="boxHeight" className="text-xs">높이 (mm)</Label>
                    <Input
                      id="boxHeight"
                      type="number"
                      min="0"
                      value={boxHeight || ''}
                      onChange={(e) => setBoxHeight(parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="font-medium"
                    />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground bg-background/50 p-3 rounded">
                  <div className="space-y-1">
                    <div>• 접착선 길이: <strong>{joinLengthM.toFixed(2)}m</strong></div>
                    <div>• 90° 코너: <strong>{corners90}개</strong></div>
                    {trayHeightMm && trayHeightMm <= 60 && (
                      <div className="text-green-600">✓ 얕은 트레이 할인 적용 가능</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <Separator />

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

              {/* 수동 접착선 길이 (평면 제품인 경우만) */}
              {productType === 'flat' && (
                <div className="space-y-2">
                  <Label htmlFor="joinLength" className="text-sm font-semibold flex items-center gap-2">
                    접착선 길이 (m)
                    <Badge variant="outline" className="text-xs">
                      수동 입력
                    </Badge>
                  </Label>
                  <Input
                    id="joinLength"
                    type="number"
                    min="0"
                    step="0.1"
                    value={joinLengthM || ''}
                    onChange={(e) => onJoinLengthChange?.(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="font-medium"
                  />
                </div>
              )}
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
                    3,000원/m
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
                    500원/개
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

              {/* 90도 코너 (평면인 경우만 수동 입력) */}
              {productType === 'flat' && (
                <div className="space-y-2">
                  <Label htmlFor="corners90" className="text-sm font-semibold flex items-center gap-2">
                    90° 코너 개수
                    <Badge variant="outline" className="text-xs">
                      4,000원/개 마감비
                    </Badge>
                  </Label>
                  <Input
                    id="corners90"
                    type="number"
                    min="0"
                    value={corners90 || ''}
                    onChange={(e) => onCorners90Change?.(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="font-medium"
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* 상세 본드 계산 */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <Checkbox
                  id="useDetailedBond"
                  checked={useDetailedBond}
                  onCheckedChange={(checked) => onDetailedBondChange?.(checked as boolean)}
                />
                <Label
                  htmlFor="useDetailedBond"
                  className="text-sm font-medium cursor-pointer flex-1"
                >
                  상세 본드 계산 사용 (수량 할인)
                  <p className="text-xs text-muted-foreground mt-1">
                    수량이 많을수록 개당 본드 비용이 감소합니다 (S/n + rL) × Q(n)
                  </p>
                </Label>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default AdvancedProcessingOptions;
