import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Scissors, Layers, Zap, Droplet, Sparkles, CheckCircle2, Settings, ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useProcessingOptions } from "@/hooks/useProcessingOptions";

interface ProcessingOption {
  id: string;
  option_id: string;
  name: string;
  description: string;
  category: 'raw' | 'processing' | 'adhesion';
}

interface ProcessingOptionsProps {
  selectedProcessing: string;
  selectedAdhesion: string;
  onProcessingSelect: (processingId: string) => void;
  onAdhesionSelect: (adhesionId: string) => void;
  isGlossyStandard: boolean;
  selectedThickness: string;
  // 수량 및 복잡도 관련 props
  qty?: number;
  onQtyChange?: (qty: number) => void;
  isComplex?: boolean;
  onComplexChange?: (isComplex: boolean) => void;
  // 추가 옵션 props (EdgeFinishingOption용)
  edgeFinishing?: boolean;
  onEdgeFinishingChange?: (value: boolean) => void;
  bulgwang?: boolean;
  onBulgwangChange?: (value: boolean) => void;
  tapung?: boolean;
  onTapungChange?: (value: boolean) => void;
  mugwangPainting?: boolean;
  onMugwangPaintingChange?: (value: boolean) => void;
}

type MainCategory = 'raw' | 'simple' | 'complex' | 'full' | 'adhesion';
type ProcessingMethod = 'auto' | 'laser' | 'cnc';
type AdhesionAngle = '45' | '90';
type AdhesionType = 'normal' | 'bubble-free';

const ProcessingOptions: React.FC<ProcessingOptionsProps> = ({
  selectedProcessing,
  selectedAdhesion,
  onProcessingSelect,
  onAdhesionSelect,
  isGlossyStandard,
  selectedThickness,
  qty = 1,
  onQtyChange,
  isComplex = false,
  onComplexChange,
  edgeFinishing,
  onEdgeFinishingChange,
  bulgwang,
  onBulgwangChange,
  tapung,
  onTapungChange,
  mugwangPainting,
  onMugwangPaintingChange
}) => {
  // 메인 카테고리 선택
  const [mainCategory, setMainCategory] = React.useState<MainCategory | null>(null);
  // 가공 방식 선택 (단순/복합/전체 재단 시)
  const [processingMethod, setProcessingMethod] = React.useState<ProcessingMethod | null>(null);
  // 접착 각도 선택
  const [adhesionAngle, setAdhesionAngle] = React.useState<AdhesionAngle | null>(null);
  // 접착 방식 선택
  const [adhesionType, setAdhesionType] = React.useState<AdhesionType | null>(null);
  
  const { isLoading } = useProcessingOptions();
  
  // 두께에 따라 자동으로 레이저/CNC 선택
  const getAutoMethod = (): 'laser' | 'cnc' => {
    const thickness = parseFloat(selectedThickness.replace('T', ''));
    return thickness <= 10 ? 'laser' : 'cnc';
  };

  // 가공 방식에 따라 실제 processing ID 매핑
  const getProcessingId = (category: MainCategory, method: ProcessingMethod): string => {
    const autoMethod = getAutoMethod();
    const actualMethod = method === 'auto' ? autoMethod : method;
    
    if (category === 'simple') {
      return actualMethod === 'laser' ? 'laser-simple' : 'cnc-simple';
    } else if (category === 'complex') {
      return actualMethod === 'laser' ? 'laser-complex' : 'cnc-complex';
    } else if (category === 'full') {
      return actualMethod === 'laser' ? 'laser-full' : 'cnc-full';
    }
    return '';
  };

  // 메인 카테고리 선택 핸들러
  const handleMainCategorySelect = (category: MainCategory) => {
    setMainCategory(category);
    setProcessingMethod(null);
    setAdhesionAngle(null);
    setAdhesionType(null);
    
    if (category === 'raw') {
      onProcessingSelect('raw-only');
      onAdhesionSelect('');
    } else {
      onProcessingSelect('');
      onAdhesionSelect('');
    }
  };

  // 가공 방식 선택 핸들러
  const handleProcessingMethodSelect = (method: ProcessingMethod) => {
    setProcessingMethod(method);
    
    if (mainCategory && mainCategory !== 'raw' && mainCategory !== 'adhesion') {
      const processingId = getProcessingId(mainCategory, method);
      onProcessingSelect(processingId);
    } else if (mainCategory === 'adhesion') {
      const processingId = getProcessingId('complex', method);
      onProcessingSelect(processingId);
    }
  };

  // 접착 각도 선택 핸들러
  const handleAdhesionAngleSelect = (angle: AdhesionAngle) => {
    setAdhesionAngle(angle);
  };

  // 접착 방식 선택 핸들러
  const handleAdhesionTypeSelect = (type: AdhesionType) => {
    setAdhesionType(type);
    
    if (type === 'normal') {
      onAdhesionSelect('adhesion-normal');
    } else if (type === 'bubble-free') {
      onAdhesionSelect('adhesion-bubble-free');
    }
  };

  // 선택 완료 여부 확인
  const isSelectionComplete = (): boolean => {
    if (!mainCategory) return false;
    
    if (mainCategory === 'raw') {
      return true;
    } else if (mainCategory === 'simple') {
      return !!processingMethod;
    } else if (mainCategory === 'complex' || mainCategory === 'full') {
      return !!processingMethod;
    } else if (mainCategory === 'adhesion') {
      return !!processingMethod && !!adhesionAngle && !!adhesionType;
    }
    
    return false;
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="text-center">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center space-y-3">
        <h3 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          가공 방법을 선택해주세요
        </h3>
        <p className="text-muted-foreground text-lg">
          단계별로 가공 옵션을 선택하세요
        </p>
      </div>

      {/* STEP 1: 메인 카테고리 선택 */}
      <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="w-5 h-5 text-primary" />
            가공 카테고리 선택
            <Badge variant="secondary" className="ml-auto">STEP 1</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* 원판 구매 */}
            <button
              onClick={() => handleMainCategorySelect('raw')}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                mainCategory === 'raw'
                  ? 'bg-primary/10 border-primary shadow-md'
                  : 'bg-background border-border hover:border-primary/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sm">원판 구매</span>
                {mainCategory === 'raw' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
              </div>
              <p className="text-xs text-muted-foreground">
                가공 없이 원판만 구매
              </p>
            </button>

            {/* 단순 재단 */}
            <button
              onClick={() => handleMainCategorySelect('simple')}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                mainCategory === 'simple'
                  ? 'bg-primary/10 border-primary shadow-md'
                  : 'bg-background border-border hover:border-primary/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Scissors className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sm">단순 재단</span>
                {mainCategory === 'simple' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
              </div>
              <p className="text-xs text-muted-foreground">
                기본 재단 작업
              </p>
            </button>

            {/* 복합 재단 */}
            <button
              onClick={() => handleMainCategorySelect('complex')}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                mainCategory === 'complex'
                  ? 'bg-primary/10 border-primary shadow-md'
                  : 'bg-background border-border hover:border-primary/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sm">복합 재단</span>
                {mainCategory === 'complex' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
              </div>
              <p className="text-xs text-muted-foreground">
                복합적인 재단 작업
              </p>
            </button>

            {/* 전체 재단 */}
            <button
              onClick={() => handleMainCategorySelect('full')}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                mainCategory === 'full'
                  ? 'bg-primary/10 border-primary shadow-md'
                  : 'bg-background border-border hover:border-primary/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sm">전체 재단</span>
                {mainCategory === 'full' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
              </div>
              <p className="text-xs text-muted-foreground">
                복잡한 모양 전체 가공
              </p>
            </button>

            {/* 접착 가공 */}
            <button
              onClick={() => handleMainCategorySelect('adhesion')}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                mainCategory === 'adhesion'
                  ? 'bg-primary/10 border-primary shadow-md'
                  : 'bg-background border-border hover:border-primary/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Droplet className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sm">접착 가공</span>
                {mainCategory === 'adhesion' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
              </div>
              <p className="text-xs text-muted-foreground">
                무기포/일반 접착
              </p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* STEP 2: 원판 구매 옵션 (원판 구매 선택 시) */}
      {mainCategory === 'raw' && (
        <>
          <Separator />
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ChevronRight className="w-5 h-5 text-primary" />
                원판 구매 옵션
                <Badge variant="secondary" className="ml-auto">STEP 2</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <button
                onClick={() => onProcessingSelect('raw-only')}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  selectedProcessing === 'raw-only'
                    ? 'bg-primary/10 border-primary shadow-md'
                    : 'bg-background border-border hover:border-primary/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5 text-primary" />
                  <span className="font-semibold">원판 단독 구매</span>
                  {selectedProcessing === 'raw-only' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  가공 없이 원판만 구매합니다
                </p>
              </button>
            </CardContent>
          </Card>
        </>
      )}

      {/* STEP 2: 가공 방식 선택 (단순/복합/전체 재단 및 접착 가공 시) */}
      {mainCategory && mainCategory !== 'raw' && (
        <>
          <Separator />
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ChevronRight className="w-5 h-5 text-primary" />
                가공 방식 선택
                <Badge variant="secondary" className="ml-auto">STEP 2</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => handleProcessingMethodSelect('auto')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    processingMethod === 'auto'
                      ? 'bg-primary/10 border-primary shadow-md'
                      : 'bg-background border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <span className="font-semibold">자동 선택</span>
                    {processingMethod === 'auto' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    두께 기준 자동 선택
                    <br />
                    (~10T: 레이저 / 10T~: CNC)
                  </p>
                </button>

                <button
                  onClick={() => handleProcessingMethodSelect('laser')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    processingMethod === 'laser'
                      ? 'bg-primary/10 border-primary shadow-md'
                      : 'bg-background border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-5 h-5 text-primary" />
                    <span className="font-semibold">
                      레이저 {
                        mainCategory === 'simple' ? '단순' : 
                        mainCategory === 'complex' ? '복합' : 
                        mainCategory === 'full' ? '전체' :
                        mainCategory === 'adhesion' ? '복합' : ''
                      } 가공
                    </span>
                    {processingMethod === 'laser' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    레이저 장비 사용
                  </p>
                </button>

                <button
                  onClick={() => handleProcessingMethodSelect('cnc')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    processingMethod === 'cnc'
                      ? 'bg-primary/10 border-primary shadow-md'
                      : 'bg-background border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="w-5 h-5 text-primary" />
                    <span className="font-semibold">
                      CNC {
                        mainCategory === 'simple' ? '단순' : 
                        mainCategory === 'complex' ? '복합' : 
                        mainCategory === 'full' ? '전체' :
                        mainCategory === 'adhesion' ? '복합' : ''
                      } 가공
                    </span>
                    {processingMethod === 'cnc' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    CNC 장비 사용
                  </p>
                </button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* STEP 3: 수량 선택 (단순 재단 시) */}
      {mainCategory === 'simple' && processingMethod && (
        <>
          <Separator />
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ChevronRight className="w-5 h-5 text-primary" />
                수량 선택
                <Badge variant="secondary" className="ml-auto">STEP 3</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <Label htmlFor="qty" className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-primary" />
                  제작 수량 (EA)
                </Label>
                <Input
                  id="qty"
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => onQtyChange?.(parseInt(e.target.value) || 1)}
                  className="font-medium"
                  placeholder="수량을 입력하세요"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  수량에 따라 할증이 적용됩니다
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* STEP 3: 접착 가공 선택 (접착 가공 시) */}
      {mainCategory === 'adhesion' && processingMethod && (
        <>
          <Separator />
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ChevronRight className="w-5 h-5 text-primary" />
                접착 가공 선택
                <Badge variant="secondary" className="ml-auto">STEP 3</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => handleAdhesionAngleSelect('45')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    adhesionAngle === '45'
                      ? 'bg-primary/10 border-primary shadow-md'
                      : 'bg-background border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold">45도 절단면 가공</span>
                    {adhesionAngle === '45' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    45도 각도로 절단면을 가공하여 접착
                  </p>
                </button>

                <button
                  onClick={() => handleAdhesionAngleSelect('90')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    adhesionAngle === '90'
                      ? 'bg-primary/10 border-primary shadow-md'
                      : 'bg-background border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold">90도 절단면 가공</span>
                    {adhesionAngle === '90' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    90도 각도로 절단면을 가공하여 접착
                  </p>
                </button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* STEP 4/5: 접착 방식 선택 (접착 가공 시) */}
      {mainCategory === 'adhesion' && processingMethod && adhesionAngle && (
        <>
          <Separator />
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ChevronRight className="w-5 h-5 text-primary" />
                접착 방식 선택
                <Badge variant="secondary" className="ml-auto">STEP 4</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => handleAdhesionTypeSelect('normal')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    adhesionType === 'normal'
                      ? 'bg-primary/10 border-primary shadow-md'
                      : 'bg-background border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold">일반 접착</span>
                    {adhesionType === 'normal' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    표준 접착 방식
                  </p>
                </button>

                <button
                  onClick={() => handleAdhesionTypeSelect('bubble-free')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    adhesionType === 'bubble-free'
                      ? 'bg-primary/10 border-primary shadow-md'
                      : 'bg-background border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold">무기포 접착</span>
                    {adhesionType === 'bubble-free' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    기포 없는 고급 접착
                  </p>
                </button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* 추가 옵션은 PanelCalculator에서 별도로 표시 */}
    </div>
  );
};

export default ProcessingOptions;
