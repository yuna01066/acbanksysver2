import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Calculator, Plus, ShoppingCart, Home } from "lucide-react";
import { MATERIALS, CASTING_QUALITIES, OTHER_ACRYLIC_QUALITIES, Material, Quality } from "@/types/calculator";
import ProcessingOptions from "./ProcessingOptions";
import ColorMixingStep from "./ColorMixingStep";
import CalculatorTypeSelection from "./CalculatorTypeSelection";
import StepIndicator from "./StepIndicator";
import SelectionSummary from "./SelectionSummary";
import MaterialSelection from "./MaterialSelection";
import QualitySelection from "./QualitySelection";
import ThicknessSelection from "./ThicknessSelection";
import SizeSelection from "./SizeSelection";
import MultipleSizeSelection, { SizeQuantitySelection } from "./MultipleSizeSelection";
import MultipleSurfaceSelection from "./MultipleSurfaceSelection";
import MultipleColorMixingStep from "./MultipleColorMixingStep";
import SurfaceSelection from "./SurfaceSelection";
import ColorSelection from "./ColorSelection";
import FilmColorSelection from "./FilmColorSelection";
import FilmSelection from "./FilmSelection";
import { useQuotes } from "@/contexts/QuoteContext";
import { usePriceCalculation } from "@/hooks/usePriceCalculation";
import { Input } from "@/components/ui/input";
import YieldCalculator from "./YieldCalculator";
import AdvancedProcessingOptions from "./AdvancedProcessingOptions";
import EdgeFinishingOption from "./EdgeFinishingOption";
const PROCESSING_OPTIONS = [{
  id: 'raw-only',
  name: '원판 단독 구매'
}, {
  id: 'simple-cutting',
  name: '단순 재단'
}, {
  id: 'complex-cutting',
  name: '복합 재단'
}, {
  id: 'edge-finishing',
  name: '엣지 격면 마감'
}, {
  id: 'bubble-free-adhesion',
  name: '무기포 접착'
}, {
  id: 'laser-cutting-simple',
  name: '레이저 커팅 (단순)'
}, {
  id: 'laser-cutting-full',
  name: '전체 레이저 커팅'
}, {
  id: 'cnc-general',
  name: 'CNC 일반 가공'
}, {
  id: 'cnc-heavy',
  name: 'CNC 고강도 가공'
}, {
  id: 'complex-shapes',
  name: '복잡한 모양 가공'
}];
const PanelCalculator = () => {
  const navigate = useNavigate();
  const {
    addQuote,
    quotes
  } = useQuotes();
  const [currentStep, setCurrentStep] = useState(0);
  const [calculatorType, setCalculatorType] = useState<'quote' | 'yield' | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<Quality | null>(null);
  const [selectedThickness, setSelectedThickness] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedSizes, setSelectedSizes] = useState<SizeQuantitySelection[]>([]);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedColorHex, setSelectedColorHex] = useState<string>('');
  const [selectedColorType, setSelectedColorType] = useState<string>('');
  const [selectedSurface, setSelectedSurface] = useState<string>('');
  const [colorMixingCost, setColorMixingCost] = useState<number>(20000);
  const [selectedProcessing, setSelectedProcessing] = useState<string>('');
  const [selectedAdhesion, setSelectedAdhesion] = useState<string>('');
  const [selectedFilm, setSelectedFilm] = useState<string>('');
  const [selectedBaseType, setSelectedBaseType] = useState<string>(''); // 필름 아크릴 기본 재질 (Clear/Bright/Astel)
  
  // 고급 옵션 상태
  const [qty, setQty] = useState<number>(1);
  const [isComplex, setIsComplex] = useState<boolean>(false);
  const [bevelLengthM, setBevelLengthM] = useState<number>(0);
  const [laserHoles, setLaserHoles] = useState<number>(0);
  const [corners90, setCorners90] = useState<number>(0);
  const [useDetailedBond, setUseDetailedBond] = useState<boolean>(false);
  const [joinLengthM, setJoinLengthM] = useState<number>(0);
  const [trayHeightMm, setTrayHeightMm] = useState<number | undefined>(undefined);
  const [edgeFinishing, setEdgeFinishing] = useState<boolean>(false);
  const [bulgwang, setBulgwang] = useState<boolean>(false);
  const [tapung, setTapung] = useState<boolean>(false);
  const [mugwangPainting, setMugwangPainting] = useState<boolean>(false);
  const [selectedAdditionalOptions, setSelectedAdditionalOptions] = useState<Record<string, number>>({});
  
  // Convert all selected options (main slots + additional options) to processingType format
  const getProcessingTypeFromOptions = () => {
    const allOptionIds: string[] = [];
    
    // 메인 슬롯에서 선택된 옵션들 추가 (selectedProcessing이 이미 "|"로 조합된 형태)
    if (selectedProcessing && selectedProcessing.includes('|')) {
      allOptionIds.push(...selectedProcessing.split('|'));
    } else if (selectedProcessing && selectedProcessing !== '' && selectedProcessing !== 'raw-only') {
      allOptionIds.push(selectedProcessing);
    }
    
    // 추가 옵션에서 수량이 있는 것들 추가
    const additionalIds = Object.entries(selectedAdditionalOptions)
      .filter(([_, quantity]) => quantity > 0)
      .map(([optionId, _]) => optionId);
    
    allOptionIds.push(...additionalIds);
    
    return allOptionIds.length > 0 ? allOptionIds.join('|') : selectedProcessing;
  };
  
  const {
    priceInfo,
    getAvailableSizes
  } = usePriceCalculation({
    selectedFactory: 'jangwon',
    selectedMaterial,
    selectedQuality,
    selectedThickness,
    selectedSize,
    selectedSizes, // 다중 선택 지원
    selectedColorType,
    selectedSurface,
    colorMixingCost,
    selectedProcessing: getProcessingTypeFromOptions() || selectedProcessing,
    selectedAdhesion,
    selectedAdditionalOptions,
    // V2 고급 옵션
    qty,
    isComplex,
    bevelLengthM,
    laserHoles,
    corners90,
    useDetailedBond,
    joinLengthM,
    trayHeightMm,
    edgeFinishing,
    bulgwang,
    tapung,
    mugwangPainting
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
      setColorMixingCost(20000);
      setSelectedProcessing('');
      setSelectedAdhesion('');
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
      setColorMixingCost(20000);
      setSelectedProcessing('');
      setSelectedAdhesion('');
      setCurrentStep(1);
    } else if (step <= 2) {
      setSelectedQuality(null);
      setSelectedColor('');
      setSelectedColorHex('');
      setSelectedThickness('');
      setSelectedSize('');
      setSelectedColorType('');
      setSelectedSurface('');
      setColorMixingCost(20000);
      setSelectedProcessing('');
      setSelectedAdhesion('');
      setCurrentStep(2);
    } else if (step <= 3) {
      setSelectedColor('');
      setSelectedColorHex('');
      setSelectedBaseType('');
      setSelectedThickness('');
      setSelectedSize('');
      setSelectedColorType('');
      setSelectedSurface('');
      setColorMixingCost(20000);
      setSelectedProcessing('');
      setSelectedAdhesion('');
      setCurrentStep(3);
    } else if (step <= 4) {
      setSelectedThickness('');
      setSelectedSize('');
      setSelectedColorType('');
      setSelectedSurface('');
      setColorMixingCost(20000);
      setSelectedProcessing('');
      setSelectedAdhesion('');
      setCurrentStep(4);
    } else if (step <= 5) {
      setSelectedSize('');
      setSelectedColorType('');
      setSelectedSurface('');
      setColorMixingCost(20000);
      setSelectedProcessing('');
      setSelectedAdhesion('');
      setCurrentStep(5);
    } else if (step <= 6) {
      setSelectedSurface('');
      setColorMixingCost(20000);
      setSelectedProcessing('');
      setSelectedAdhesion('');
      setCurrentStep(6);
    } else if (step <= 7) {
      setColorMixingCost(20000);
      setSelectedProcessing('');
      setSelectedAdhesion('');
      setCurrentStep(7);
    } else if (step <= 8) {
      // 가공 선택 단계 리셋 (수량/복잡도 포함)
      setQty(1);
      setIsComplex(false);
      setSelectedProcessing('');
      setSelectedAdhesion('');
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
    setCurrentStep(2);
  };
  const handleQualitySelect = (quality: Quality) => {
    console.log('Quality selected:', quality);
    setSelectedQuality(quality);
    resetFromStep(3);
    setCurrentStep(3);
  };
  const handleColorSelect = (colorId: string, colorInfo: {
    acCode: string;
    hexCode: string;
  }) => {
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

  const handleMultipleSizeSelect = (selections: SizeQuantitySelection[]) => {
    console.log('Multiple sizes selected:', selections);
    setSelectedSizes(selections);
  };

  const handleNextFromMultipleSize = () => {
    resetFromStep(6);
    setCurrentStep(6);
  };
  const handleSurfaceSelect = (surface: string) => {
    console.log('Surface selected:', surface);
    setSelectedSurface(surface);
    
    // 필름 아크릴의 경우 조색비를 기본 20000원으로 설정
    if (selectedQuality?.id === 'film-acrylic') {
      setColorMixingCost(20000);
    }
    
    resetFromStep(7);
    setCurrentStep(7);
  };

  const handleNextFromMultipleSurface = () => {
    resetFromStep(7);
    setCurrentStep(7);
  };
  const handleColorMixingAdd = () => {
    setColorMixingCost(prev => {
      const newCost = prev + 10000;
      console.log('Color mixing cost added:', newCost, 'Previous:', prev);
      return newCost;
    });
  };
  const handleColorMixingRemove = () => {
    setColorMixingCost(prev => {
      const newCost = Math.max(0, prev - 10000);
      console.log('Color mixing cost removed:', newCost, 'Previous:', prev);
      return newCost;
    });
  };
  const handleProcessingSelect = (processingId: string) => {
    console.log('Processing selected:', processingId);
    setSelectedProcessing(processingId);
  };

  const handleAdhesionSelect = (adhesionId: string) => {
    console.log('Adhesion selected:', adhesionId);
    setSelectedAdhesion(adhesionId);
  };
  const handleNextStepFromColorMixing = () => {
    // 필름 아크릴의 경우 필름 선택 단계로, 아니면 가공 선택 단계로 이동
    if (selectedQuality?.id === 'film-acrylic') {
      setCurrentStep(8); // 필름 선택 단계
    } else {
      setCurrentStep(8); // 가공 선택 단계 (수량 포함)
    }
  };

  const handleNextFromMultipleColorMixing = () => {
    // 가공 옵션 단계로 진입하면 기본값 설정하여 실시간 가격 계산
    if (!selectedProcessing) {
      setSelectedProcessing('none');
    }
    
    // 필름 아크릴의 경우 필름 선택 단계로, 아니면 가공 선택 단계로 이동
    if (selectedQuality?.id === 'film-acrylic') {
      setCurrentStep(8); // 필름 선택 단계
    } else {
      setCurrentStep(8); // 가공 선택 단계 (수량 포함)
    }
  };
  
  const handleFilmSelect = (filmId: string) => {
    console.log('Film selected:', filmId);
    setSelectedFilm(filmId);
    
    // 가공 옵션 단계로 진입하면 기본값 설정하여 실시간 가격 계산
    if (!selectedProcessing) {
      setSelectedProcessing('none');
    }
    
    setCurrentStep(9); // 가공 선택 단계로 이동 (수량 포함)
  };
  const handleAddQuote = () => {
    // 다중 선택 방식으로 검증 수정
    if (!selectedMaterial || !selectedQuality || !selectedThickness || selectedSizes.length === 0) {
      alert('모든 필수 항목을 선택해주세요.');
      return;
    }

    // 각 사이즈별로 면수가 선택되었는지 확인
    const allSizesHaveSurface = selectedSizes.every(s => s.surface);
    if (!allSizesHaveSurface) {
      alert('모든 판재의 면수를 선택해주세요.');
      return;
    }

    const processingName = PROCESSING_OPTIONS.find(p => p.id === selectedProcessing)?.name || '';
    
    // 다중 선택된 사이즈를 하나의 견적으로 처리 (총 가격은 priceInfo.totalPrice)
    const quoteData = {
      factory: 'jangwon',
      material: selectedMaterial.name,
      quality: selectedQuality.name,
      thickness: selectedThickness,
      size: selectedSizes.map(s => `${s.size} (${s.quantity}개)`).join(', '),
      colorType: selectedColorType,
      selectedColor: selectedColor,
      selectedColorHex: selectedColorHex,
      surface: selectedSizes.map(s => `${s.size}: ${s.surface}`).join(', '),
      colorMixingCost: selectedSizes.reduce((sum, s) => sum + (s.colorMixingCost || 0), 0),
      processing: selectedProcessing,
      processingName: processingName,
      totalPrice: priceInfo.totalPrice,
      quantity: 1,
      breakdown: priceInfo.breakdown
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
    setSelectedSizes([]);
    setSelectedColorType('');
    setSelectedSurface('');
    setColorMixingCost(20000);
    setSelectedProcessing('');
    setSelectedAdhesion('');
    setSelectedFilm('');
    setSelectedBaseType('');
    alert('견적이 추가되었습니다!');
  };
  const handleViewQuotesSummary = () => {
    navigate('/quotes-summary');
  };
  const handlePanelSelectFromYield = (panelData: {
    quality: string;
    thickness: string;
    size: string;
  }) => {
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
  // 필름 아크릴의 경우 maxSteps를 10으로 설정 (필름 선택 단계 추가)
  const maxSteps = selectedQuality?.id === 'film-acrylic' ? 10 : 9;
  return <div className="min-h-screen p-6">
      <Card className="w-full max-w-4xl mx-auto border-border/50 shadow-smooth animate-fade-up overflow-hidden">
        <CardHeader className="text-center pb-8 border-b border-border/50">
          <div className="flex justify-between items-center mb-6 print:hidden">
            <Button onClick={() => navigate('/')} variant="outline" size="sm" className="animate-fade-up">
              <Home className="w-4 h-4" />
              홈으로
            </Button>
            {quotes.length > 0 && <Button onClick={handleViewQuotesSummary} variant="default" className="animate-slide-in">
                <ShoppingCart className="w-4 h-4" />
                담은 견적 보기 ({quotes.length})
              </Button>}
          </div>
          <CardTitle className="flex items-center justify-center gap-3 mb-3">
            <Calculator className="w-7 h-7 text-primary" />
            <div className="text-2xl">
              <span className="font-bold">ACBANK</span>{" "}
              <span className="font-medium text-muted-foreground">Quotation System</span>
            </div>
          </CardTitle>
          <p className="text-body text-muted-foreground">아크뱅크 견적 시스템</p>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          {/* 수율 계산기 */}
          {currentStep === -1 && <YieldCalculator onBack={handleBackToCalculatorSelection} onPanelSelect={panelData => handlePanelSelectFromYield(panelData)} />}
          
          {/* 견적 계산기 단계들 */}
          {currentStep >= 0 && <>
              <StepIndicator currentStep={currentStep + 1} maxSteps={maxSteps} />
          
          {/* 선택된 옵션 요약 및 가격 계산 결과 - Step 0에서는 숨김 */}
          {currentStep > 0 && <SelectionSummary 
            selectedFactory="jangwon" 
            selectedMaterial={selectedMaterial} 
            selectedQuality={selectedQuality} 
            selectedColor={selectedColor} 
            selectedThickness={selectedThickness} 
            selectedSize={selectedSize}
            selectedSizes={selectedSizes}
            selectedColorType={selectedColorType} 
            selectedSurface={selectedSurface} 
            colorMixingCost={colorMixingCost} 
            selectedProcessing={selectedProcessing} 
            selectedAdhesion={selectedAdhesion} 
            processingOptions={PROCESSING_OPTIONS} 
            basePrice={priceInfo.breakdown.find(b => 
              b.label.includes('기본가') || 
              b.label.includes('색상판') || 
              b.label.includes('보급판')
            )?.price}
            factories={[{
              id: 'jangwon',
              name: '장원'
            }]}
            priceInfo={priceInfo}
          />}
          
          {/* Step 0: 계산기 유형 선택 */}
          {currentStep === 0 && <>
              <CalculatorTypeSelection onTypeSelect={handleCalculatorTypeSelect} />
              <div className="mt-8 p-4 bg-muted/50 rounded-lg border border-border/50">
                <p className="text-sm text-muted-foreground text-center leading-relaxed">
                  이 프로그램은 아크뱅크 사내용 프로그램으로 무단 복제 및 배포를 금지하고 있습니다.<br />
                  또한, 본 시스템의 회사 관련 내용을 무단으로 유출 시 법적인 제재를 받으실 수 있습니다.
                </p>
              </div>
            </>}

          {/* Step 1: 소재 선택 */}
          {currentStep === 1 && <MaterialSelection materials={MATERIALS} selectedMaterial={selectedMaterial} selectedFactory="jangwon" factories={[{
            id: 'jangwon',
            name: '장원'
          }]} onMaterialSelect={handleMaterialSelect} />}

          {/* Step 2: 재질 선택 */}
          {currentStep === 2 && selectedMaterial?.id === 'casting' && <QualitySelection qualities={CASTING_QUALITIES} selectedQuality={selectedQuality} selectedFactory="jangwon" onQualitySelect={handleQualitySelect} />}
          {currentStep === 2 && selectedMaterial?.id === 'acrylic-dye' && <QualitySelection qualities={CASTING_QUALITIES} selectedQuality={selectedQuality} selectedFactory="jangwon" onQualitySelect={handleQualitySelect} />}
          {currentStep === 2 && selectedMaterial?.id === 'other-acrylic' && <QualitySelection qualities={OTHER_ACRYLIC_QUALITIES} selectedQuality={selectedQuality} selectedFactory="jangwon" onQualitySelect={handleQualitySelect} />}

          {/* Step 3: 색상 선택 */}
          {currentStep === 3 && selectedQuality && (
            <>
              {selectedQuality.id === 'film-acrylic' ? (
                <FilmColorSelection 
                  selectedColor={selectedColor}
                  selectedBaseType={selectedBaseType}
                  onColorSelect={handleColorSelect}
                  onBaseTypeSelect={setSelectedBaseType}
                />
              ) : (
                <ColorSelection 
                  selectedColor={selectedColor} 
                  selectedQuality={selectedQuality} 
                  onColorSelect={handleColorSelect} 
                />
              )}
            </>
          )}

          {/* Step 4: 두께 선택 */}
          {currentStep === 4 && selectedColor && <ThicknessSelection thicknesses={selectedQuality.thicknesses} selectedThickness={selectedThickness} onThicknessSelect={handleThicknessSelect} />}

          {/* Step 5: 사이즈 선택 (다중 선택 가능) */}
          {currentStep === 5 && selectedThickness && (
            <MultipleSizeSelection 
              availableSizes={getAvailableSizes()} 
              selectedSizes={selectedSizes}
              onSelectionChange={handleMultipleSizeSelect}
              onNext={handleNextFromMultipleSize}
              selectedThickness={selectedThickness}
            />
          )}

          {/* Step 6: 면수 선택 (각 판재별) */}
          {currentStep === 6 && selectedSizes.length > 0 && (
            <MultipleSurfaceSelection 
              selectedSizes={selectedSizes}
              onSelectionChange={setSelectedSizes}
              onNext={handleNextFromMultipleSurface}
              isGlossyStandard={selectedQuality?.id === 'glossy-standard'}
              forceSingle={selectedColor === 'A002' || selectedColor === 'A003'} 
              qualityId={selectedQuality?.id}
            />
          )}

          {/* Step 7: 조색비 추가 (각 판재별) */}
          {currentStep === 7 && selectedSizes.length > 0 && (
            <MultipleColorMixingStep 
              selectedSizes={selectedSizes}
              onSelectionChange={setSelectedSizes}
              onNext={handleNextFromMultipleColorMixing}
              isGlossyStandard={selectedQuality?.id === 'glossy-standard'}
              isFilmAcrylic={selectedQuality?.id === 'film-acrylic'}
            />
          )}

          {/* Step 8: 필름 선택 (필름 아크릴인 경우만) */}
          {currentStep === 8 && selectedQuality?.id === 'film-acrylic' && (
            <FilmSelection 
              selectedFilm={selectedFilm} 
              onFilmSelect={handleFilmSelect} 
            />
          )}

          {/* Step 8 또는 9: 가공 선택 (수량 및 복잡도 포함) */}
          {((currentStep === 8 && selectedQuality?.id !== 'film-acrylic') || 
            (currentStep === 9 && selectedQuality?.id === 'film-acrylic')) && (
            <ProcessingOptions 
              selectedProcessing={selectedProcessing}
              selectedAdhesion={selectedAdhesion}
              onProcessingSelect={handleProcessingSelect}
              onAdhesionSelect={handleAdhesionSelect}
              isGlossyStandard={selectedQuality?.id === 'glossy-standard'}
              selectedThickness={selectedThickness}
              qty={qty}
              onQtyChange={setQty}
              isComplex={isComplex}
              onComplexChange={setIsComplex}
              edgeFinishing={edgeFinishing}
              onEdgeFinishingChange={setEdgeFinishing}
              bulgwang={bulgwang}
              onBulgwangChange={setBulgwang}
              tapung={tapung}
              onTapungChange={setTapung}
              mugwangPainting={mugwangPainting}
              onMugwangPaintingChange={setMugwangPainting}
              selectedAdditionalOptions={selectedAdditionalOptions}
              onAdditionalOptionsChange={setSelectedAdditionalOptions}
            />
          )}

          {/* 견적 추가 버튼 */}
          {((currentStep === 8 && selectedQuality?.id !== 'film-acrylic' && selectedSizes.length > 0) ||
            (currentStep === 9 && selectedQuality?.id === 'film-acrylic' && selectedSizes.length > 0)) && (
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
          {currentStep > 0 && <>
              <Separator className="my-8" />
              <div className="flex justify-center">
                <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)} className="px-6">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  이전 단계로
                </Button>
              </div>
            </>}
            </>}
        </CardContent>
      </Card>
    </div>;
};
export default PanelCalculator;