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
          필요한 가공 옵션을 선택하세요
        </p>
      </div>

      {/* 원판 옵션 */}
      {rawOptions.length > 0 && (
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-red-500/5 to-red-500/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="w-5 h-5 text-red-500" />
              원판 구매
              <Badge variant="destructive" className="ml-auto">STEP 1</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {rawOptions.map((option) => {
                const Icon = getIcon(option.option_type);
                const isSelected = selectedProcessing === option.option_id;
                
                return (
                  <button
                    key={option.id}
                    onClick={() => {
                      onProcessingSelect(option.option_id);
                      onAdhesionSelect(''); // 원판 선택 시 접착 해제
                    }}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? 'bg-primary/10 border-primary shadow-md'
                        : 'bg-background border-border hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-5 h-5 ${getTypeColor(option.option_type)}`} />
                      <span className="font-semibold text-sm">{option.name}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
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
      )}

      {/* 재단 옵션 */}
      {processingOptionsFiltered.length > 0 && (
        <>
          <Separator />
          <Card className="border-2 border-primary/30 bg-gradient-to-br from-blue-500/5 to-blue-500/10">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Scissors className="w-5 h-5 text-blue-500" />
                재단 가공
                <Badge variant="secondary" className="ml-auto">STEP 2</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {processingOptionsFiltered.map((option) => {
                  const Icon = getIcon(option.option_type);
                  const isSelected = selectedProcessing === option.option_id;
                  
                  return (
                    <button
                      key={option.id}
                      onClick={() => onProcessingSelect(option.option_id)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        isSelected
                          ? 'bg-primary/10 border-primary shadow-md'
                          : 'bg-background border-border hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-5 h-5 ${getTypeColor(option.option_type)}`} />
                        <span className="font-semibold text-sm">{option.name}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
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

      {/* 접착 옵션 (재단이 선택된 경우에만 표시) */}
      {adhesionOptions.length > 0 && selectedProcessing && selectedProcessing !== 'raw-only' && (
        <>
          <Separator />
          <Card className="border-2 border-primary/30 bg-gradient-to-br from-purple-500/5 to-purple-500/10">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Droplet className="w-5 h-5 text-purple-500" />
                접착 옵션 (선택사항)
                <Badge variant="outline" className="ml-auto">STEP 3</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* 접착 없음 옵션 */}
                <button
                  onClick={() => onAdhesionSelect('')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    !selectedAdhesion
                      ? 'bg-primary/10 border-primary shadow-md'
                      : 'bg-background border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-5 h-5 text-muted-foreground" />
                    <span className="font-semibold text-sm">접착 없음</span>
                    {!selectedAdhesion && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    접착 작업을 하지 않습니다
                  </p>
                </button>

                {adhesionOptions.map((option) => {
                  const Icon = getIcon(option.option_type);
                  const isSelected = selectedAdhesion === option.option_id;
                  
                  return (
                    <button
                      key={option.id}
                      onClick={() => onAdhesionSelect(option.option_id)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        isSelected
                          ? 'bg-primary/10 border-primary shadow-md'
                          : 'bg-background border-border hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-5 h-5 ${getTypeColor(option.option_type)}`} />
                        <span className="font-semibold text-sm">{option.name}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
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

      {/* 추가 옵션 */}
      {activeAdditionalOptions && activeAdditionalOptions.length > 0 && selectedProcessing && selectedProcessing !== 'raw-only' && (
        <>
          <Separator />
          <Card className="border-2 border-primary/30 bg-gradient-to-br from-green-500/5 to-green-500/10">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="w-5 h-5 text-green-500" />
                추가 옵션 (선택사항)
                <Badge variant="outline" className="ml-auto">STEP 4</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeAdditionalOptions.map((option) => {
                  let isChecked = false;
                  let onToggle: ((value: boolean) => void) | undefined;

                  // 옵션별로 매핑
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

      {/* 수량 및 복잡도 설정 */}
      {selectedProcessing && selectedProcessing !== 'raw-only' && onQtyChange && onComplexChange && (
        <>
          <Separator />
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="w-5 h-5 text-primary" />
                가공 상세 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ProcessingOptions;
