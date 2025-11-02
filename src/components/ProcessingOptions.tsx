import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Scissors, Droplet, Settings, CheckCircle2, Info } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useProcessingOptions } from "@/hooks/useProcessingOptions";
import { Skeleton } from "@/components/ui/skeleton";

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
  // 추가 옵션 props
  edgeFinishing?: boolean;
  onEdgeFinishingChange?: (value: boolean) => void;
  bulgwang?: boolean;
  onBulgwangChange?: (value: boolean) => void;
  tapung?: boolean;
  onTapungChange?: (value: boolean) => void;
  mugwangPainting?: boolean;
  onMugwangPaintingChange?: (value: boolean) => void;
}

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
  const { processingOptions, activeAdditionalOptions, isLoading } = useProcessingOptions();
  const [mainCategory, setMainCategory] = React.useState<'raw' | 'processing' | 'adhesion' | ''>('');
  const [processingType, setProcessingType] = React.useState<'simple' | 'complex' | 'full' | ''>('');
  const [adhesionMethod, setAdhesionMethod] = React.useState<'laser' | 'cnc' | ''>('');
  const [adhesionAngle, setAdhesionAngle] = React.useState<'45' | '90' | ''>('');
  const [adhesionType, setAdhesionType] = React.useState<'normal' | 'bubble-free' | ''>('');
  const [numFaces, setNumFaces] = React.useState<number>(4);

  // 옵션을 타입별로 그룹화
  const rawOptions = processingOptions?.filter(opt => opt.option_type === 'raw' && opt.is_active) || [];
  const processingOptionsFiltered = processingOptions?.filter(opt => opt.option_type === 'processing' && opt.is_active) || [];
  const adhesionOptions = processingOptions?.filter(opt => opt.option_type === 'adhesion' && opt.is_active) || [];

  // 타입별 아이콘 매핑
  const getIcon = (type: string) => {
    switch (type) {
      case 'raw': return Package;
      case 'processing': return Scissors;
      case 'adhesion': return Droplet;
      case 'additional': return Settings;
      default: return Info;
    }
  };

  // 타입별 색상 매핑
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'raw': return 'text-red-500';
      case 'processing': return 'text-blue-500';
      case 'adhesion': return 'text-purple-500';
      case 'additional': return 'text-green-500';
      default: return 'text-primary';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
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
          원하시는 가공 방식을 선택하세요
        </p>
      </div>

      {/* 메인 카테고리 선택 */}
      <Card className="border-2 border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">가공 방식 선택</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 원판 단독구매 */}
            <button
              onClick={() => {
                setMainCategory('raw');
                if (rawOptions[0]) {
                  onProcessingSelect(rawOptions[0].option_id);
                }
                onAdhesionSelect('');
              }}
              className={`p-6 rounded-lg border-2 transition-all text-left ${
                mainCategory === 'raw'
                  ? 'bg-primary/10 border-primary shadow-md'
                  : 'bg-background border-border hover:border-primary/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-6 h-6 text-red-500" />
                <span className="font-semibold">원판 단독구매</span>
                {mainCategory === 'raw' && <CheckCircle2 className="w-5 h-5 text-primary ml-auto" />}
              </div>
              <p className="text-sm text-muted-foreground">
                재단 없이 원판만 구매
              </p>
            </button>

            {/* 재단 */}
            <button
              onClick={() => {
                setMainCategory('processing');
                setProcessingType('');
                onProcessingSelect('');
                onAdhesionSelect('');
              }}
              className={`p-6 rounded-lg border-2 transition-all text-left ${
                mainCategory === 'processing'
                  ? 'bg-primary/10 border-primary shadow-md'
                  : 'bg-background border-border hover:border-primary/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Scissors className="w-6 h-6 text-blue-500" />
                <span className="font-semibold">재단</span>
                {mainCategory === 'processing' && <CheckCircle2 className="w-5 h-5 text-primary ml-auto" />}
              </div>
              <p className="text-sm text-muted-foreground">
                단순/복합/전체 가공 중 선택
              </p>
            </button>

            {/* 접착 가공 */}
            <button
              onClick={() => {
                setMainCategory('adhesion');
                setProcessingType('');
                setAdhesionMethod('');
                setAdhesionAngle('');
                setAdhesionType('');
                onProcessingSelect('');
                onAdhesionSelect('');
              }}
              className={`p-6 rounded-lg border-2 transition-all text-left ${
                mainCategory === 'adhesion'
                  ? 'bg-primary/10 border-primary shadow-md'
                  : 'bg-background border-border hover:border-primary/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Droplet className="w-6 h-6 text-purple-500" />
                <span className="font-semibold">접착 가공</span>
                {mainCategory === 'adhesion' && <CheckCircle2 className="w-5 h-5 text-primary ml-auto" />}
              </div>
              <p className="text-sm text-muted-foreground">
                복합 접착 가공 옵션
              </p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* 재단 하위 옵션 */}
      {mainCategory === 'processing' && (
        <>
          <Separator />
          <Card className="border-2 border-primary/30 bg-gradient-to-br from-blue-500/5 to-blue-500/10">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Scissors className="w-5 h-5 text-blue-500" />
                재단 가공 방식
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {processingOptionsFiltered.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      onProcessingSelect(option.option_id);
                    }}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedProcessing === option.option_id
                        ? 'bg-primary/10 border-primary shadow-md'
                        : 'bg-background border-border hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-sm">{option.name}</span>
                      {selectedProcessing === option.option_id && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                    </div>
                    {option.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {option.description}
                      </p>
                    )}
                    {option.multiplier && (
                      <div className="mt-2 text-xs font-semibold text-primary">
                        배수: ×{option.multiplier}
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* 수량 및 복잡도 */}
              {selectedProcessing && onQtyChange && onComplexChange && (
                <div className="mt-6 pt-6 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="qty" className="text-sm font-semibold">
                        제작 수량 (EA)
                      </Label>
                      <Input
                        id="qty"
                        type="number"
                        min="1"
                        value={qty}
                        onChange={(e) => onQtyChange(parseInt(e.target.value) || 1)}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">가공 복잡도</Label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onComplexChange(false)}
                          className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                            !isComplex
                              ? 'bg-primary/10 border-primary'
                              : 'bg-background border-border hover:border-primary/30'
                          }`}
                        >
                          <span className="text-sm font-medium">단순</span>
                        </button>
                        <button
                          onClick={() => onComplexChange(true)}
                          className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                            isComplex
                              ? 'bg-primary/10 border-primary'
                              : 'bg-background border-border hover:border-primary/30'
                          }`}
                        >
                          <span className="text-sm font-medium">복잡</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* 접착 가공 하위 옵션 */}
      {mainCategory === 'adhesion' && (
        <>
          <Separator />
          <Card className="border-2 border-primary/30 bg-gradient-to-br from-purple-500/5 to-purple-500/10">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Droplet className="w-5 h-5 text-purple-500" />
                접착 가공 상세 옵션
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 복합가공 방식 선택 */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">복합가공 방식</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setAdhesionMethod('laser')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      adhesionMethod === 'laser'
                        ? 'bg-primary/10 border-primary'
                        : 'bg-background border-border hover:border-primary/30'
                    }`}
                  >
                    <span className="font-medium">레이저</span>
                  </button>
                  <button
                    onClick={() => setAdhesionMethod('cnc')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      adhesionMethod === 'cnc'
                        ? 'bg-primary/10 border-primary'
                        : 'bg-background border-border hover:border-primary/30'
                    }`}
                  >
                    <span className="font-medium">CNC</span>
                  </button>
                </div>
              </div>

              {/* 접착면 가공 각도 */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">접착면 가공 각도</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setAdhesionAngle('45')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      adhesionAngle === '45'
                        ? 'bg-primary/10 border-primary'
                        : 'bg-background border-border hover:border-primary/30'
                    }`}
                  >
                    <span className="font-medium">45도</span>
                  </button>
                  <button
                    onClick={() => setAdhesionAngle('90')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      adhesionAngle === '90'
                        ? 'bg-primary/10 border-primary'
                        : 'bg-background border-border hover:border-primary/30'
                    }`}
                  >
                    <span className="font-medium">90도</span>
                  </button>
                </div>
              </div>

              {/* 접착 방식 */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">접착 방식</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {adhesionOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => onAdhesionSelect(option.option_id)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        selectedAdhesion === option.option_id
                          ? 'bg-primary/10 border-primary shadow-md'
                          : 'bg-background border-border hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-sm">{option.name}</span>
                        {selectedAdhesion === option.option_id && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                      </div>
                      {option.description && (
                        <p className="text-xs text-muted-foreground">
                          {option.description}
                        </p>
                      )}
                      {option.multiplier && (
                        <div className="mt-2 text-xs font-semibold text-primary">
                          배수: ×{option.multiplier}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 고급 옵션 */}
              {selectedAdhesion && (
                <div className="pt-6 border-t space-y-4">
                  <Label className="text-sm font-semibold">고급 옵션</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="numFaces" className="text-sm">
                        면체 수
                      </Label>
                      <Input
                        id="numFaces"
                        type="number"
                        min="2"
                        value={numFaces}
                        onChange={(e) => setNumFaces(parseInt(e.target.value) || 4)}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="adhesion-qty" className="text-sm">
                        제작 수량 (EA)
                      </Label>
                      <Input
                        id="adhesion-qty"
                        type="number"
                        min="1"
                        value={qty}
                        onChange={(e) => onQtyChange && onQtyChange(parseInt(e.target.value) || 1)}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* 추가 옵션 */}
      {(mainCategory === 'processing' || mainCategory === 'adhesion') && 
       (selectedProcessing || selectedAdhesion) &&
       activeAdditionalOptions && 
       activeAdditionalOptions.length > 0 && (
        <>
          <Separator />
          <Card className="border-2 border-primary/30 bg-gradient-to-br from-green-500/5 to-green-500/10">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="w-5 h-5 text-green-500" />
                추가 옵션 (선택사항)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeAdditionalOptions.map((option) => {
                  let isChecked = false;
                  let onToggle: ((value: boolean) => void) | undefined;

                  switch (option.option_id) {
                    case 'edgeFinishing':
                      isChecked = edgeFinishing || false;
                      onToggle = onEdgeFinishingChange;
                      break;
                    case 'bulgwang':
                      isChecked = bulgwang || false;
                      onToggle = onBulgwangChange;
                      break;
                    case 'tapung':
                      isChecked = tapung || false;
                      onToggle = onTapungChange;
                      break;
                    case 'mugwangPainting':
                      isChecked = mugwangPainting || false;
                      onToggle = onMugwangPaintingChange;
                      break;
                  }

                  if (!onToggle) return null;

                  return (
                    <button
                      key={option.id}
                      onClick={() => onToggle && onToggle(!isChecked)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        isChecked
                          ? 'bg-primary/10 border-primary shadow-md'
                          : 'bg-background border-border hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Settings className={`w-5 h-5 ${isChecked ? 'text-primary' : 'text-green-500'}`} />
                        <span className="font-semibold text-sm">{option.name}</span>
                        {isChecked && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                      </div>
                      {option.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {option.description}
                        </p>
                      )}
                      {option.multiplier && (
                        <div className="mt-2 text-xs font-semibold text-primary">
                          배수: ×{option.multiplier}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ProcessingOptions;
