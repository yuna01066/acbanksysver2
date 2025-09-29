import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Calculator, Plus, ShoppingCart } from "lucide-react";
import { 
  MATERIALS, 
  CASTING_QUALITIES, 
  Material, 
  Quality 
} from "@/types/calculator";
import PriceBreakdown from "./PriceBreakdown";
import ProcessingOptions from "./ProcessingOptions";
import ColorMixingStep from "./ColorMixingStep";
import CalculatorTypeSelection from "./CalculatorTypeSelection";
import StepIndicator from "./StepIndicator";
import SelectionSummary from "./SelectionSummary";
import MaterialSelection from "./MaterialSelection";
import QualitySelection from "./QualitySelection";
import ThicknessSelection from "./ThicknessSelection";
import SizeSelection from "./SizeSelection";
import SurfaceSelection from "./SurfaceSelection";
import ColorSelection from "./ColorSelection";
import { useQuotes } from "@/contexts/QuoteContext";
import { usePriceCalculation } from "@/hooks/usePriceCalculation";
import { Input } from "@/components/ui/input";
import YieldCalculator from "./YieldCalculator";

const PROCESSING_OPTIONS = [
  { id: 'raw-only', name: '원판 단독 구매' },
  { id: 'simple-cutting', name: '단순 재단' },
  { id: 'complex-cutting', name: '복합 재단' },
  { id: 'edge-finishing', name: '엣지 격면 마감' },
  { id: 'bubble-free-adhesion', name: '무기포 접착' },
  { id: 'laser-cutting-simple', name: '레이저 커팅 (단순)' },
  { id: 'laser-cutting-full', name: '전체 레이저 커팅' },
  { id: 'cnc-general', name: 'CNC 일반 가공' },
  { id: 'cnc-heavy', name: 'CNC 고강도 가공' },
  { id: 'complex-shapes', name: '복잡한 모양 가공' }
];

const PanelCalculator = () => {
  const navigate = useNavigate();
  const { addQuote, quotes } = useQuotes();
  const [currentStep, setCurrentStep] = useState(0);
  const [calculatorType, setCalculatorType] = useState<'quote' | 'yield' | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<Quality | null>(null);
  const [selectedThickness, setSelectedThickness] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedColorHex, setSelectedColorHex] = useState<string>('');
  const [selectedColorType, setSelectedColorType] = useState<string>('');
  const [selectedSurface, setSelectedSurface] = useState<string>('');
  const [colorMixingCost, setColorMixingCost] = useState<number>(0);
  const [selectedProcessing, setSelectedProcessing] = useState<string>('');
  const [serialNumber, setSerialNumber] = useState<string>('');

  const { priceInfo, getAvailableSizes } = usePriceCalculation({
    selectedFactory: 'jangwon',
    selectedMaterial,
    selectedQuality,
    selectedThickness,
    selectedSize,
    selectedColorType,
    selectedSurface,
    colorMixingCost,
    selectedProcessing
  });

  // 이전 단계로 돌아가기 버튼
  const resetFromStep = (step: number) => {
    if (step <= 0) {
      setSelectedMaterial(null);
      setSelectedQuality(null);
      setSelectedColor('');
      setSelectedColorHex('');
      setSelectedThickness('');
      setSelectedSize('');
      setSelectedColorType('');
      setSelectedSurface('');
      setColorMixingCost(0);
      setSelectedProcessing('');
      setCurrentStep(0);
    } else if (step <= 1) {
      setSelectedMaterial(null);
      setSelectedQuality(null);
      setSelectedColor('');
      setSelectedColorHex('');
      setSelectedThickness('');
      setSelectedSize('');
      setSelectedColorType('');
      setSelectedSurface('');
      setColorMixingCost(0);
      setSelectedProcessing('');
      setCurrentStep(1);
    } else if (step <= 2) {
      setSelectedQuality(null);
      setSelectedColor('');
      setSelectedColorHex('');
      setSelectedThickness('');
      setSelectedSize('');
      setSelectedColorType('');
      setSelectedSurface('');
      setColorMixingCost(0);
      setSelectedProcessing('');
      setCurrentStep(2);
    } else if (step <= 3) {
      setSelectedColor('');
      setSelectedColorHex('');
      setSelectedThickness('');
      setSelectedSize('');
      setSelectedColorType('');
      setSelectedSurface('');
      setColorMixingCost(0);
      setSelectedProcessing('');
      setCurrentStep(3);
    } else if (step <= 4) {
      setSelectedThickness('');
      setSelectedSize('');
      setSelectedColorType('');
      setSelectedSurface('');
      setColorMixingCost(0);
      setSelectedProcessing('');
      setCurrentStep(4);
    } else if (step <= 5) {
      setSelectedSize('');
      setSelectedColorType('');
      setSelectedSurface('');
      setColorMixingCost(0);
      setSelectedProcessing('');
      setCurrentStep(5);
    } else if (step <= 6) {
      setSelectedSurface('');
      setColorMixingCost(0);
      setSelectedProcessing('');
      setCurrentStep(6);
    } else if (step <= 7) {
      setColorMixingCost(0);
      setSelectedProcessing('');
      setCurrentStep(7);
    } else if (step <= 8) {
      setSelectedProcessing('');
      setCurrentStep(8);
    }
  };

  const handleCalculatorTypeSelect = (type: 'quote' | 'yield') => {
    setCalculatorType(type);
    if (type === 'quote') {
      setCurrentStep(1);
    } else {
      setCurrentStep(-1); // 수율 계산기는 특별한 step
    }
  };

  const handleMaterialSelect = (material: Material) => {
    console.log('Material selected:', material);
    setSelectedMaterial(material);
    resetFromStep(2);
    if (material.id === 'casting' || material.id === 'acrylic-dye') {
      setCurrentStep(2);
    } else {
      alert('해당 소재는 아직 지원되지 않습니다.');
    }
  };

  const handleQualitySelect = (quality: Quality) => {
    console.log('Quality selected:', quality);
    setSelectedQuality(quality);
    resetFromStep(3);
    setCurrentStep(3);
  };

  const handleColorSelect = (colorId: string, colorInfo: { acCode: string; hexCode: string }) => {
    console.log('Color selected:', colorId, colorInfo);
    setSelectedColor(colorInfo.acCode);
    setSelectedColorHex(colorInfo.hexCode);
    resetFromStep(4);
    setCurrentStep(4);
  };

  const handleThicknessSelect = (thickness: string) => {
    console.log('Thickness selected:', thickness);
    setSelectedThickness(thickness);
    resetFromStep(5);
    setCurrentStep(5);
  };

  const handleSizeSelect = (size: string) => {
    console.log('Size selected:', size);
    setSelectedSize(size);
    resetFromStep(6);
    setCurrentStep(6); // 바로 면수 선택으로 이동
  };

  const handleSurfaceSelect = (surface: string) => {
    console.log('Surface selected:', surface);
    setSelectedSurface(surface);
    resetFromStep(7);
    setCurrentStep(7);
  };

  const handleColorMixingAdd = () => {
    setColorMixingCost(prev => prev + 10000);
    console.log('Color mixing cost added:', colorMixingCost + 10000);
  };

  const handleColorMixingRemove = () => {
    setColorMixingCost(prev => Math.max(0, prev - 10000));
    console.log('Color mixing cost removed:', Math.max(0, colorMixingCost - 10000));
  };

  const handleProcessingSelect = (processingId: string) => {
    console.log('Processing selected:', processingId);
    setSelectedProcessing(processingId);
  };

  const handleNextStepFromColorMixing = () => {
    setCurrentStep(8);
  };

  const handleAddQuote = () => {
    if (!selectedMaterial || !selectedQuality || !selectedThickness || !selectedSize || !selectedSurface) {
      alert('모든 필수 항목을 선택해주세요.');
      return;
    }

    const processingName = PROCESSING_OPTIONS.find(p => p.id === selectedProcessing)?.name || '';
    
    const quoteData = {
      factory: 'jangwon',
      material: selectedMaterial.name,
      quality: selectedQuality.name,
      thickness: selectedThickness,
      size: selectedSize,
      colorType: selectedColorType,
      selectedColor: selectedColor,
      selectedColorHex: selectedColorHex,
      surface: selectedSurface,
      colorMixingCost: colorMixingCost,
      processing: selectedProcessing,
      processingName: processingName,
      totalPrice: priceInfo.totalPrice,
      quantity: 1,
      breakdown: priceInfo.breakdown,
      serialNumber: serialNumber
    };

    addQuote(quoteData);
    
    // Reset form for new quote
    setCurrentStep(0);
    setCalculatorType(null);
    setSelectedMaterial(null);
    setSelectedQuality(null);
    setSelectedColor('');
    setSelectedColorHex('');
    setSelectedThickness('');
    setSelectedSize('');
    setSelectedColorType('');
    setSelectedSurface('');
    setColorMixingCost(0);
    setSelectedProcessing('');
    setSerialNumber('');
    
    alert('견적이 추가되었습니다!');
  };

  const handleViewQuotesSummary = () => {
    navigate('/quotes-summary');
  };

  const handlePanelSelectFromYield = (panelData: { quality: string; thickness: string; size: string }) => {
    // 재질 매핑 (캐스팅만 지원)
    const castingMaterial = MATERIALS.find(m => m.id === 'casting');
    if (castingMaterial) {
      setSelectedMaterial(castingMaterial);
    }
    
    // 재질 매핑
    const quality = CASTING_QUALITIES.find(q => q.id === panelData.quality);
    if (quality) {
      setSelectedQuality(quality);
    }
    
    // 두께와 사이즈 설정
    setSelectedThickness(panelData.thickness);
    setSelectedSize(panelData.size);
    
    // 견적계산기 모드로 전환하고 면수 선택 단계로 이동
    setCalculatorType('quote');
    setCurrentStep(6); // 면수 선택 단계로 바로 이동
  };

  const handleBackToCalculatorSelection = () => {
    setCurrentStep(0);
    setCalculatorType(null);
  };

  const maxSteps = 9;

  return (
    <div className="min-h-screen p-6">
      <Card className="w-full max-w-4xl mx-auto border-border/50 shadow-smooth animate-fade-up overflow-hidden">
        <CardHeader className="text-center pb-8 border-b border-border/50">
          <div className="flex justify-between items-center mb-6 print:hidden">
            <div></div>
            {quotes.length > 0 && (
              <Button 
                onClick={handleViewQuotesSummary}
                variant="default"
                className="animate-slide-in"
              >
                <ShoppingCart className="w-4 h-4" />
                담은 견적 보기 ({quotes.length})
              </Button>
            )}
          </div>
          <CardTitle className="text-display flex items-center justify-center gap-4 mb-3">
            <Calculator className="w-8 h-8 text-primary" />
            판재 단가 계산기
          </CardTitle>
          <p className="text-body text-muted-foreground">정확하고 빠른 판재 가격 계산</p>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          {/* 수율 계산기 */}
          {currentStep === -1 && (
            <YieldCalculator 
              selectedQuality={selectedQuality?.id || 'glossy-color'}
              selectedThickness={selectedThickness}
              selectedSurface={selectedSurface}
              selectedColor={selectedColor}
              selectedFactory="jangwon"
              selectedProcessing={selectedProcessing}
              onBack={handleBackToCalculatorSelection}
              onPanelSelect={(panelData) => handlePanelSelectFromYield(panelData)}
            />
          )}
          
          {/* 견적 계산기 단계들 */}
          {currentStep >= 0 && (
            <>
              <StepIndicator currentStep={currentStep + 1} maxSteps={maxSteps} />
          
          {/* 선택된 옵션 요약 - Step 0에서는 숨김 */}
          {currentStep > 0 && (
            <SelectionSummary
              selectedFactory="jangwon"
              selectedMaterial={selectedMaterial}
              selectedQuality={selectedQuality}
              selectedColor={selectedColor}
              selectedThickness={selectedThickness}
              selectedSize={selectedSize}
              selectedColorType={selectedColorType}
              selectedSurface={selectedSurface}
              colorMixingCost={colorMixingCost}
              selectedProcessing={selectedProcessing}
              processingOptions={PROCESSING_OPTIONS}
              factories={[{ id: 'jangwon', name: '장원' }]}
            />
          )}
          
          {/* Step 0: 계산기 유형 선택 */}
          {currentStep === 0 && (
            <CalculatorTypeSelection
              onTypeSelect={handleCalculatorTypeSelect}
            />
          )}

          {/* Step 1: 소재 선택 */}
          {currentStep === 1 && (
            <MaterialSelection
              materials={MATERIALS}
              selectedMaterial={selectedMaterial}
              selectedFactory="jangwon"
              factories={[{ id: 'jangwon', name: '장원' }]}
              onMaterialSelect={handleMaterialSelect}
            />
          )}
          
          {/* 가격 정보 표시 */}
          {selectedSize && (
            <PriceBreakdown 
              totalPrice={priceInfo.totalPrice}
              breakdown={priceInfo.breakdown}
              isVisible={true}
            />
          )}

          {/* Step 2: 재질 선택 */}
          {currentStep === 2 && (selectedMaterial?.id === 'casting' || selectedMaterial?.id === 'acrylic-dye') && (
            <QualitySelection
              qualities={CASTING_QUALITIES}
              selectedQuality={selectedQuality}
              selectedFactory="jangwon"
              onQualitySelect={handleQualitySelect}
            />
          )}

          {/* Step 3: 색상 선택 */}
          {currentStep === 3 && selectedQuality && (
            <ColorSelection
              selectedColor={selectedColor}
              onColorSelect={handleColorSelect}
            />
          )}

          {/* Step 4: 두께 선택 */}
          {currentStep === 4 && selectedColor && (
            <ThicknessSelection
              thicknesses={selectedQuality.thicknesses}
              selectedThickness={selectedThickness}
              onThicknessSelect={handleThicknessSelect}
            />
          )}

          {/* Step 5: 사이즈 선택 */}
          {currentStep === 5 && selectedThickness && (
            <SizeSelection
              availableSizes={getAvailableSizes()}
              selectedSize={selectedSize}
              onSizeSelect={handleSizeSelect}
            />
          )}

          {/* Step 6: 면수 선택 */}
          {currentStep === 6 && selectedSize && (
            <SurfaceSelection
              selectedSurface={selectedSurface}
              onSurfaceSelect={handleSurfaceSelect}
              isGlossyStandard={selectedQuality?.id === 'glossy-standard'}
            />
          )}

          {/* Step 7: 조색비 추가 */}
          {currentStep === 7 && selectedSurface && (
            <ColorMixingStep
              colorMixingCost={colorMixingCost}
              onColorMixingAdd={handleColorMixingAdd}
              onColorMixingRemove={handleColorMixingRemove}
              onNextStep={handleNextStepFromColorMixing}
              isGlossyStandard={selectedQuality?.id === 'glossy-standard'}
            />
          )}

          {/* Step 8: 가공 선택 */}
          {currentStep === 8 && (
            <ProcessingOptions
              selectedProcessing={selectedProcessing}
              onProcessingSelect={handleProcessingSelect}
              isGlossyStandard={selectedQuality?.id === 'glossy-standard'}
            />
          )}

          {/* 시리얼 넘버 입력 */}
          {currentStep === 8 && selectedProcessing && (
            <>
              <Separator className="my-8" />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">클라이언트 메모 (선택사항)</h3>
                <p className="text-sm text-gray-600">
                  클라이언트의 요청사항이나 참고할 내용을 입력해주세요.
                </p>
                <div className="max-w-md">
                  <Input
                    type="text"
                    placeholder="요청사항을 입력해주세요"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
            </>
          )}

          {/* 견적 추가 버튼 */}
          {currentStep === 8 && selectedProcessing && priceInfo.totalPrice > 0 && (
            <>
              <Separator className="my-8" />
              <div className="flex justify-center gap-4">
                <Button 
                  onClick={handleAddQuote}
                  size="lg"
                  className="px-8 animate-fade-up"
                >
                  <Plus className="w-5 h-5" />
                  견적 추가
                </Button>
              </div>
            </>
          )}

          {/* 이전 단계로 돌아가기 버튼 */}
          {currentStep > 0 && (
            <>
              <Separator className="my-8" />
              <div className="flex justify-center">
                <Button 
                  variant="ghost" 
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-6"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  이전 단계로
                </Button>
              </div>
            </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PanelCalculator;