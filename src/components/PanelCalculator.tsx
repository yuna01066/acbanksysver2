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
import StepIndicator from "./StepIndicator";
import SelectionSummary from "./SelectionSummary";
import FactorySelection from "./FactorySelection";
import MaterialSelection from "./MaterialSelection";
import QualitySelection from "./QualitySelection";
import ThicknessSelection from "./ThicknessSelection";
import SizeSelection from "./SizeSelection";
import ColorTypeSelection from "./ColorTypeSelection";
import SurfaceSelection from "./SurfaceSelection";
import { useQuotes } from "@/contexts/QuoteContext";
import { usePriceCalculation } from "@/hooks/usePriceCalculation";
import { Input } from "@/components/ui/input";

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

const FACTORIES = [
  { id: 'jangwon', name: '장원' },
  { id: 'tbd1', name: '미정' },
  { id: 'tbd2', name: '미정' }
];

const PanelCalculator = () => {
  const navigate = useNavigate();
  const { addQuote, quotes } = useQuotes();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedFactory, setSelectedFactory] = useState<string>('');
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<Quality | null>(null);
  const [selectedThickness, setSelectedThickness] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColorType, setSelectedColorType] = useState<string>('');
  const [selectedSurface, setSelectedSurface] = useState<string>('');
  const [colorMixingCost, setColorMixingCost] = useState<number>(0);
  const [selectedProcessing, setSelectedProcessing] = useState<string>('');
  const [serialNumber, setSerialNumber] = useState<string>('');

  const { priceInfo, getAvailableSizes } = usePriceCalculation({
    selectedFactory,
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
      setSelectedFactory('');
      setSelectedMaterial(null);
      setSelectedQuality(null);
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
      setSelectedThickness('');
      setSelectedSize('');
      setSelectedColorType('');
      setSelectedSurface('');
      setColorMixingCost(0);
      setSelectedProcessing('');
      setCurrentStep(1);
    } else if (step <= 2) {
      setSelectedQuality(null);
      setSelectedThickness('');
      setSelectedSize('');
      setSelectedColorType('');
      setSelectedSurface('');
      setColorMixingCost(0);
      setSelectedProcessing('');
      setCurrentStep(2);
    } else if (step <= 3) {
      setSelectedThickness('');
      setSelectedSize('');
      setSelectedColorType('');
      setSelectedSurface('');
      setColorMixingCost(0);
      setSelectedProcessing('');
      setCurrentStep(3);
    } else if (step <= 4) {
      setSelectedSize('');
      setSelectedColorType('');
      setSelectedSurface('');
      setColorMixingCost(0);
      setSelectedProcessing('');
      setCurrentStep(4);
    } else if (step <= 5) {
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

  const handleFactorySelect = (factoryId: string) => {
    console.log('Factory selected:', factoryId);
    setSelectedFactory(factoryId);
    resetFromStep(1);
    
    if (factoryId === 'jangwon') {
      setCurrentStep(1);
    } else {
      setCurrentStep(1);
    }
  };

  const handleMaterialSelect = (material: Material) => {
    console.log('Material selected:', material);
    setSelectedMaterial(material);
    resetFromStep(2);
    if (material.id === 'casting') {
      setCurrentStep(2);
    } else {
      if (selectedFactory === 'jangwon') {
        alert('해당 소재는 아직 지원되지 않습니다.');
      } else {
        setCurrentStep(2);
      }
    }
  };

  const handleQualitySelect = (quality: Quality) => {
    console.log('Quality selected:', quality);
    setSelectedQuality(quality);
    resetFromStep(3);
    setCurrentStep(3);
  };

  const handleThicknessSelect = (thickness: string) => {
    console.log('Thickness selected:', thickness);
    setSelectedThickness(thickness);
    resetFromStep(4);
    setCurrentStep(4);
  };

  const handleSizeSelect = (size: string) => {
    console.log('Size selected:', size);
    setSelectedSize(size);
    resetFromStep(5);
    if (selectedQuality?.id === 'glossy-standard') {
      setCurrentStep(5);
    } else {
      setCurrentStep(6);
    }
  };

  const handleColorTypeSelect = (colorType: string) => {
    console.log('Color type selected:', colorType);
    setSelectedColorType(colorType);
    resetFromStep(6);
    setCurrentStep(6);
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
    if (selectedFactory !== 'jangwon') {
      alert('현재 장원 공장만 견적 추가가 가능합니다.');
      return;
    }
    
    if (!selectedMaterial || !selectedQuality || !selectedThickness || !selectedSize || !selectedSurface) {
      alert('모든 필수 항목을 선택해주세요.');
      return;
    }

    const processingName = PROCESSING_OPTIONS.find(p => p.id === selectedProcessing)?.name || '';
    
    const quoteData = {
      factory: selectedFactory,
      material: selectedMaterial.name,
      quality: selectedQuality.name,
      thickness: selectedThickness,
      size: selectedSize,
      colorType: selectedColorType,
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
    setSelectedFactory('');
    setSelectedMaterial(null);
    setSelectedQuality(null);
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

  const maxSteps = selectedQuality?.id === 'glossy-standard' ? 8 : 8;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-4xl mx-auto shadow-sm border-0 rounded-xl overflow-hidden bg-white">
        <CardHeader className="text-center pb-6 bg-white border-b border-gray-100">
          <div className="flex justify-between items-center mb-4 print:hidden">
            <div></div>
            {quotes.length > 0 && (
              <Button 
                onClick={handleViewQuotesSummary}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                <ShoppingCart className="w-4 h-4" />
                견적서 작성 완료 ({quotes.length})
              </Button>
            )}
          </div>
          <CardTitle className="text-2xl font-semibold flex items-center justify-center gap-3 mb-2 text-gray-900">
            <Calculator className="w-6 h-6" />
            판재 단가 계산기
          </CardTitle>
          <p className="text-gray-600">정확하고 빠른 판재 가격 계산</p>
        </CardHeader>
        <CardContent className="p-8">
          <StepIndicator currentStep={currentStep + 1} maxSteps={maxSteps + 1} />
          
          <SelectionSummary
            selectedFactory={selectedFactory}
            selectedMaterial={selectedMaterial}
            selectedQuality={selectedQuality}
            selectedThickness={selectedThickness}
            selectedSize={selectedSize}
            selectedColorType={selectedColorType}
            selectedSurface={selectedSurface}
            colorMixingCost={colorMixingCost}
            selectedProcessing={selectedProcessing}
            processingOptions={PROCESSING_OPTIONS}
            factories={FACTORIES}
          />
          
          {/* 가격 정보 표시 */}
          {selectedSize && selectedFactory === 'jangwon' && (
            <PriceBreakdown 
              totalPrice={priceInfo.totalPrice}
              breakdown={priceInfo.breakdown}
              isVisible={true}
            />
          )}
          
          {/* Step 0: 공장 선택 */}
          {currentStep === 0 && (
            <FactorySelection
              factories={FACTORIES}
              selectedFactory={selectedFactory}
              onFactorySelect={handleFactorySelect}
            />
          )}

          {/* Step 1: 소재 선택 */}
          {currentStep === 1 && selectedFactory && (
            <MaterialSelection
              materials={MATERIALS}
              selectedMaterial={selectedMaterial}
              selectedFactory={selectedFactory}
              factories={FACTORIES}
              onMaterialSelect={handleMaterialSelect}
            />
          )}

          {/* Step 2: 재질 선택 */}
          {currentStep === 2 && selectedMaterial?.id === 'casting' && (
            <QualitySelection
              qualities={CASTING_QUALITIES}
              selectedQuality={selectedQuality}
              selectedFactory={selectedFactory}
              onQualitySelect={handleQualitySelect}
            />
          )}

          {/* Step 3: 두께 선택 */}
          {currentStep === 3 && selectedQuality && (
            <ThicknessSelection
              thicknesses={selectedQuality.thicknesses}
              selectedThickness={selectedThickness}
              onThicknessSelect={handleThicknessSelect}
            />
          )}

          {/* Step 4: 사이즈 선택 */}
          {currentStep === 4 && selectedThickness && (
            <SizeSelection
              availableSizes={getAvailableSizes()}
              selectedSize={selectedSize}
              onSizeSelect={handleSizeSelect}
            />
          )}

          {/* Step 5: 색상타입 선택 */}
          {currentStep === 5 && selectedSize && selectedQuality?.id === 'glossy-standard' && (
            <ColorTypeSelection
              selectedColorType={selectedColorType}
              onColorTypeSelect={handleColorTypeSelect}
            />
          )}

          {/* Step 6: 면수 선택 */}
          {currentStep === 6 && 
           ((selectedQuality?.id === 'glossy-standard' && selectedColorType) || 
            (selectedQuality?.id !== 'glossy-standard' && selectedSize)) && (
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
                <h3 className="text-lg font-semibold text-gray-900">시리얼 넘버 입력 (선택사항)</h3>
                <p className="text-sm text-gray-600">
                  컬러 시리얼 넘버를 입력하시면 견적서에서 해당 정보를 확인할 수 있습니다.
                </p>
                <div className="max-w-md">
                  <Input
                    type="text"
                    placeholder="예: ABC123, COLOR-001 등"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
            </>
          )}

          {/* 견적 추가 버튼 */}
          {currentStep === 8 && selectedProcessing && (selectedFactory !== 'jangwon' || priceInfo.totalPrice > 0) && (
            <>
              <Separator className="my-8" />
              <div className="flex justify-center gap-4">
                <Button 
                  onClick={handleAddQuote}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg font-semibold rounded-lg transition-all duration-200 flex items-center gap-3"
                  disabled={selectedFactory !== 'jangwon'}
                >
                  <Plus className="w-5 h-5" />
                  {selectedFactory === 'jangwon' ? '견적 추가' : '견적 추가 (준비중)'}
                </Button>
              </div>
              {selectedFactory !== 'jangwon' && (
                <p className="text-center text-gray-500 mt-2 text-sm">
                  현재 장원 공장만 견적 추가가 가능합니다
                </p>
              )}
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
                  className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 px-6 py-3 rounded-lg font-medium transition-all duration-200"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  이전 단계로
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PanelCalculator;
