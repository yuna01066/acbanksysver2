import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Calculator, Plus, ShoppingCart, Home } from "lucide-react";
import { CASTING_QUALITIES, Quality } from "@/types/calculator";
import PriceBreakdown from "./PriceBreakdown";
import ProcessingOptions from "./ProcessingOptions";
import ColorMixingStep from "./ColorMixingStep";
import StepIndicator from "./StepIndicator";
import SelectionSummary from "./SelectionSummary";
import QualitySelection from "./QualitySelection";
import ThicknessSelection from "./ThicknessSelection";
import SizeSelection from "./SizeSelection";
import SurfaceSelection from "./SurfaceSelection";
import FilmSelection from "./FilmSelection";
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

// 필름 아크릴용 재질 옵션 (Clear, Bright, Astel만)
const FILM_ACRYLIC_QUALITIES = CASTING_QUALITIES.filter(q => 
  q.id === 'glossy-color' || q.id === 'satin-color' || q.id === 'astel-color'
);

const FilmAcrylicCalculator = () => {
  const navigate = useNavigate();
  const { addQuote, quotes } = useQuotes();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedQuality, setSelectedQuality] = useState<Quality | null>(null);
  const [selectedThickness, setSelectedThickness] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedSurface, setSelectedSurface] = useState<string>('');
  const [colorMixingCost, setColorMixingCost] = useState<number>(20000); // 기본 2만원
  const [selectedFilm, setSelectedFilm] = useState<string>('');
  const [selectedProcessing, setSelectedProcessing] = useState<string>('');
  const [serialNumber, setSerialNumber] = useState<string>('');

  const { priceInfo, getAvailableSizes } = usePriceCalculation({
    selectedFactory: 'jangwon',
    selectedMaterial: { id: 'other-acrylic', name: '기타 아크릴 제작' },
    selectedQuality,
    selectedThickness,
    selectedSize,
    selectedColorType: '',
    selectedSurface,
    colorMixingCost,
    selectedProcessing
  });

  // 필름 가격 추가
  const filmPrice = selectedFilm ? 10000 : 0;
  const totalPriceWithFilm = priceInfo.totalPrice + filmPrice;

  const resetFromStep = (step: number) => {
    if (step <= 1) {
      setSelectedQuality(null);
      setSelectedThickness('');
      setSelectedSize('');
      setSelectedSurface('');
      setColorMixingCost(20000);
      setSelectedFilm('');
      setSelectedProcessing('');
      setCurrentStep(1);
    } else if (step <= 2) {
      setSelectedThickness('');
      setSelectedSize('');
      setSelectedSurface('');
      setColorMixingCost(20000);
      setSelectedFilm('');
      setSelectedProcessing('');
      setCurrentStep(2);
    } else if (step <= 3) {
      setSelectedSize('');
      setSelectedSurface('');
      setColorMixingCost(20000);
      setSelectedFilm('');
      setSelectedProcessing('');
      setCurrentStep(3);
    } else if (step <= 4) {
      setSelectedSurface('');
      setColorMixingCost(20000);
      setSelectedFilm('');
      setSelectedProcessing('');
      setCurrentStep(4);
    } else if (step <= 5) {
      setColorMixingCost(20000);
      setSelectedFilm('');
      setSelectedProcessing('');
      setCurrentStep(5);
    } else if (step <= 6) {
      setSelectedFilm('');
      setSelectedProcessing('');
      setCurrentStep(6);
    } else if (step <= 7) {
      setSelectedProcessing('');
      setCurrentStep(7);
    }
  };

  const handleQualitySelect = (quality: Quality) => {
    setSelectedQuality(quality);
    // Bright와 Astel은 무조건 단면
    if (quality.id === 'satin-color' || quality.id === 'astel-color') {
      setSelectedSurface('single');
    }
    resetFromStep(2);
    setCurrentStep(2);
  };

  const handleThicknessSelect = (thickness: string) => {
    setSelectedThickness(thickness);
    resetFromStep(3);
    setCurrentStep(3);
  };

  const handleSizeSelect = (size: string) => {
    setSelectedSize(size);
    resetFromStep(4);
    setCurrentStep(4);
  };

  const handleSurfaceSelect = (surface: string) => {
    setSelectedSurface(surface);
    resetFromStep(5);
    setCurrentStep(5);
  };

  const handleColorMixingAdd = () => {
    setColorMixingCost(prev => prev + 10000);
  };

  const handleColorMixingRemove = () => {
    setColorMixingCost(prev => Math.max(20000, prev - 10000));
  };

  const handleNextStepFromColorMixing = () => {
    setCurrentStep(6);
  };

  const handleFilmSelect = (filmId: string) => {
    setSelectedFilm(filmId);
    setCurrentStep(7);
  };

  const handleProcessingSelect = (processingId: string) => {
    setSelectedProcessing(processingId);
  };

  const handleAddQuote = () => {
    if (!selectedQuality || !selectedThickness || !selectedSize || !selectedSurface || !selectedFilm) {
      alert('모든 필수 항목을 선택해주세요.');
      return;
    }

    const processingName = PROCESSING_OPTIONS.find(p => p.id === selectedProcessing)?.name || '';
    const filmName = selectedFilm === 'moru' ? '모루 필름' : '도트 필름';

    const quoteData = {
      factory: 'jangwon',
      material: '필름 아크릴',
      quality: selectedQuality.name,
      thickness: selectedThickness,
      size: selectedSize,
      colorType: '',
      selectedColor: '',
      selectedColorHex: '',
      surface: selectedSurface,
      colorMixingCost: colorMixingCost,
      processing: selectedProcessing,
      processingName: processingName,
      totalPrice: totalPriceWithFilm,
      quantity: 1,
      breakdown: [
        ...priceInfo.breakdown,
        { label: `필름 선택 (${filmName})`, price: filmPrice }
      ],
      serialNumber: serialNumber
    };

    addQuote(quoteData);

    // Reset form
    setCurrentStep(1);
    setSelectedQuality(null);
    setSelectedThickness('');
    setSelectedSize('');
    setSelectedSurface('');
    setColorMixingCost(20000);
    setSelectedFilm('');
    setSelectedProcessing('');
    setSerialNumber('');
    alert('견적이 추가되었습니다!');
  };

  const handleViewQuotesSummary = () => {
    navigate('/quotes-summary');
  };

  const maxSteps = 8;

  return (
    <div className="min-h-screen p-6">
      <Card className="w-full max-w-4xl mx-auto border-border/50 shadow-smooth animate-fade-up overflow-hidden">
        <CardHeader className="text-center pb-8 border-b border-border/50">
          <div className="flex justify-between items-center mb-6 print:hidden">
            <Button onClick={() => navigate('/calculator')} variant="outline" size="sm" className="animate-fade-up">
              <ArrowLeft className="w-4 h-4" />
              계산기 선택으로
            </Button>
            {quotes.length > 0 && (
              <Button onClick={handleViewQuotesSummary} variant="default" className="animate-slide-in">
                <ShoppingCart className="w-4 h-4" />
                담은 견적 보기 ({quotes.length})
              </Button>
            )}
          </div>
          <CardTitle className="flex items-center justify-center gap-3 mb-3">
            <Calculator className="w-7 h-7 text-primary" />
            <div className="text-2xl">
              <span className="font-bold">필름 아크릴</span>{" "}
              <span className="font-medium text-muted-foreground">견적 계산기</span>
            </div>
          </CardTitle>
          <p className="text-body text-muted-foreground">필름 아크릴 견적 시스템</p>
        </CardHeader>

        <CardContent className="p-8 space-y-8">
          <StepIndicator currentStep={currentStep} maxSteps={maxSteps} />

          {/* 선택된 옵션 요약 */}
          {currentStep > 1 && (
            <SelectionSummary
              selectedFactory="jangwon"
              selectedMaterial={{ id: 'film-acrylic', name: '필름 아크릴' }}
              selectedQuality={selectedQuality}
              selectedColor=""
              selectedThickness={selectedThickness}
              selectedSize={selectedSize}
              selectedColorType=""
              selectedSurface={selectedSurface}
              colorMixingCost={colorMixingCost}
              selectedProcessing={selectedProcessing}
              processingOptions={PROCESSING_OPTIONS}
              factories={[{ id: 'jangwon', name: '장원' }]}
            />
          )}

          {/* Step 1: 재질 선택 (Clear/Bright/Astel) */}
          {currentStep === 1 && (
            <QualitySelection
              qualities={FILM_ACRYLIC_QUALITIES}
              selectedQuality={selectedQuality}
              selectedFactory="jangwon"
              onQualitySelect={handleQualitySelect}
            />
          )}

          {/* Step 2: 두께 선택 */}
          {currentStep === 2 && selectedQuality && (
            <ThicknessSelection
              thicknesses={selectedQuality.thicknesses}
              selectedThickness={selectedThickness}
              onThicknessSelect={handleThicknessSelect}
            />
          )}

          {/* Step 3: 사이즈 선택 */}
          {currentStep === 3 && selectedThickness && (
            <SizeSelection
              availableSizes={getAvailableSizes()}
              selectedSize={selectedSize}
              onSizeSelect={handleSizeSelect}
              selectedThickness={selectedThickness}
            />
          )}

          {/* Step 4: 면수 선택 (Bright/Astel은 자동 단면) */}
          {currentStep === 4 && selectedSize && (
            <>
              {selectedQuality?.id === 'satin-color' || selectedQuality?.id === 'astel-color' ? (
                <div className="space-y-4 animate-fade-up">
                  <p className="text-center text-muted-foreground">
                    {selectedQuality.name}은 단면만 지원됩니다.
                  </p>
                  <div className="flex justify-center">
                    <Button onClick={() => setCurrentStep(5)} size="lg">
                      다음 단계로
                    </Button>
                  </div>
                </div>
              ) : (
                <SurfaceSelection
                  selectedSurface={selectedSurface}
                  onSurfaceSelect={handleSurfaceSelect}
                  isGlossyStandard={false}
                />
              )}
            </>
          )}

          {/* Step 5: 조색비 */}
          {currentStep === 5 && selectedSurface && (
            <ColorMixingStep
              colorMixingCost={colorMixingCost}
              onColorMixingAdd={handleColorMixingAdd}
              onColorMixingRemove={handleColorMixingRemove}
              onNextStep={handleNextStepFromColorMixing}
              isGlossyStandard={false}
            />
          )}

          {/* Step 6: 필름 선택 */}
          {currentStep === 6 && (
            <FilmSelection
              selectedFilm={selectedFilm}
              onFilmSelect={handleFilmSelect}
            />
          )}

          {/* Step 7: 가공 선택 */}
          {currentStep === 7 && selectedFilm && (
            <ProcessingOptions
              selectedProcessing={selectedProcessing}
              onProcessingSelect={handleProcessingSelect}
              isGlossyStandard={false}
            />
          )}

          {/* 가격 정보 표시 */}
          {selectedSize && (
            <PriceBreakdown
              totalPrice={totalPriceWithFilm}
              breakdown={[
                ...priceInfo.breakdown,
                ...(selectedFilm ? [{ 
                  label: `필름 선택 (${selectedFilm === 'moru' ? '모루 필름' : '도트 필름'})`, 
                  price: filmPrice 
                }] : [])
              ]}
              isVisible={true}
            />
          )}

          {/* 시리얼 넘버 입력 */}
          {currentStep === 7 && selectedProcessing && (
            <>
              <Separator className="my-8" />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">클라이언트 메모 (선택사항)</h3>
                <p className="text-sm text-muted-foreground">
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
          {currentStep === 7 && selectedProcessing && totalPriceWithFilm > 0 && (
            <>
              <Separator className="my-8" />
              <div className="flex justify-center gap-4">
                <Button onClick={handleAddQuote} size="lg" className="px-8 animate-fade-up">
                  <Plus className="w-5 h-5" />
                  견적 추가
                </Button>
              </div>
            </>
          )}

          {/* 이전 단계로 돌아가기 버튼 */}
          {currentStep > 1 && (
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
        </CardContent>
      </Card>
    </div>
  );
};

export default FilmAcrylicCalculator;
