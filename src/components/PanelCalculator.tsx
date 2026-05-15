import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ArrowRight, Calculator, Plus, ShoppingCart, Home } from "lucide-react";
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
import ManualProductEntry, { ManualProductItem } from "./ManualProductEntry";

const DEFAULT_COLOR_MIXING_COST = 40000;

interface PricingVersion {
  id: string;
  version_name: string;
  supplier_name: string;
  effective_from: string;
}

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
  name: '엣지 경면 마감'
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

interface PanelCalculatorProps {
  initialType?: 'quote' | 'yield' | null;
}

const PanelCalculator = ({ initialType = null }: PanelCalculatorProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    addQuote,
    quotes
  } = useQuotes();
  const [currentStep, setCurrentStep] = useState(0);
  const [calculatorType, setCalculatorType] = useState<'quote' | 'yield' | null>(initialType);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<Quality | null>(null);
  const [selectedThickness, setSelectedThickness] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedSizes, setSelectedSizes] = useState<SizeQuantitySelection[]>([]);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedColorHex, setSelectedColorHex] = useState<string>('');
  const [selectedColorType, setSelectedColorType] = useState<string>('');
  const [customColorName, setCustomColorName] = useState<string>('');
  const [customOpacity, setCustomOpacity] = useState<string>('');
  const [selectedSurface, setSelectedSurface] = useState<string>('');
  const [colorMixingCost, setColorMixingCost] = useState<number>(DEFAULT_COLOR_MIXING_COST);
  const [selectedProcessing, setSelectedProcessing] = useState<string>('');
  const [selectedProcessingName, setSelectedProcessingName] = useState<string>('');
  const [selectedAdhesion, setSelectedAdhesion] = useState<string>('');
  const [selectedFilm, setSelectedFilm] = useState<string>('');
  const [selectedBaseType, setSelectedBaseType] = useState<string>(''); // 필름 아크릴 기본 재질 (Clear/Bright/Astel)
  const [activePricingVersion, setActivePricingVersion] = useState<PricingVersion | null>(null);
  
  // 편집 모드 관련 상태
  const [editMode, setEditMode] = useState<string | null>(null);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [itemIndex, setItemIndex] = useState<number | null>(null);
  
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
  const [yieldAppliedSelection, setYieldAppliedSelection] = useState<{
    thickness: string;
    sizes: SizeQuantitySelection[];
  } | null>(null);
  
  // 제품 제작 수동 입력 상태
  const [manualProductItems, setManualProductItems] = useState<ManualProductItem[]>([]);
  
  // URL 파라미터에서 편집 데이터 복원
  useEffect(() => {
    // addToQuote 모드: 기존 발행 견적서에 새 항목 추가
    const addToQuoteId = searchParams.get('addToQuote');
    if (addToQuoteId) {
      setEditMode('addToSaved');
      setSavedQuoteId(addToQuoteId);
      setItemIndex(null);
      return;
    }

    const editModeParam = searchParams.get('editMode');
    if (editModeParam === 'saved') {
      console.log('Edit mode detected, restoring quote data from URL params');
      console.log('All URL params:', Object.fromEntries(searchParams.entries()));

      // 조색비 복원 (저장 견적 → 계산기 편집 진입 시 초기화되는 문제 방지)
      const colorMixingCostParam = searchParams.get('colorMixingCost');
      const restoredColorMixingCost = colorMixingCostParam !== null
        ? Number(decodeURIComponent(colorMixingCostParam))
        : NaN;
      const hasRestoredColorMixingCost = Number.isFinite(restoredColorMixingCost);
      if (hasRestoredColorMixingCost) {
        console.log('Restoring colorMixingCost:', restoredColorMixingCost);
        setColorMixingCost(restoredColorMixingCost);
      }
      
      setEditMode(editModeParam);
      setSavedQuoteId(searchParams.get('savedQuoteId'));
      setItemIndex(searchParams.get('itemIndex') ? parseInt(searchParams.get('itemIndex')!) : null);
      
      // 소재 복원 (material 이름으로 매칭)
      const materialParam = searchParams.get('material');
      if (materialParam) {
        const decodedMaterial = decodeURIComponent(materialParam);
        console.log('Restoring material:', decodedMaterial);
        const material = MATERIALS.find(m => m.name === decodedMaterial || m.id === decodedMaterial);
        if (material) {
          setSelectedMaterial(material);
          console.log('Material set to:', material);
        }
      }
      
      // 재질 복원 (quality 이름으로 매칭)
      const qualityParam = searchParams.get('quality');
      if (qualityParam) {
        const decodedQuality = decodeURIComponent(qualityParam);
        console.log('Restoring quality:', decodedQuality);
        const allQualities = [...CASTING_QUALITIES, ...OTHER_ACRYLIC_QUALITIES];
        const quality = allQualities.find(q => q.name === decodedQuality || q.id === decodedQuality);
        if (quality) {
          setSelectedQuality(quality);
          console.log('Quality set to:', quality);
        }
      }
      
      // 두께 복원
      const thickness = searchParams.get('thickness');
      if (thickness) {
        const decodedThickness = decodeURIComponent(thickness);
        console.log('Restoring thickness:', decodedThickness);
        setSelectedThickness(decodedThickness);
      }
      
      // 사이즈 복원
      const size = searchParams.get('size');
      if (size) {
        const decodedSize = decodeURIComponent(size);
        console.log('Restoring size:', decodedSize);
        setSelectedSize(decodedSize);
        
        // 다중 사이즈 형식 파싱: "대3*6 (920*1820) (1개)" 또는 "대3*6 (920*1820) (1개), 4*8 (1200*2400) (2개)"
        const sizeEntries = decodedSize.split(', ').map(entry => {
          // "대3*6 (920*1820) (1개)" 형식 파싱
          const match = entry.match(/(.+?)\s*\((\d+)개\)$/);
          if (match) {
            return { 
              size: match[1].trim(), 
              quantity: parseInt(match[2]), 
              surface: '', 
              // undefined로 두면 MultipleColorMixingStep에서 기본값(40,000) 초기화 가능
              colorMixingCost: hasRestoredColorMixingCost ? undefined : DEFAULT_COLOR_MIXING_COST 
            };
          }
          return { size: entry, quantity: 1, surface: '', colorMixingCost: hasRestoredColorMixingCost ? undefined : DEFAULT_COLOR_MIXING_COST };
        });

        // 저장된 견적에서 넘어온 조색비를 각 사이즈 항목에 적용
        // (saved_quotes.items에는 현재 총 조색비만 저장되므로, 다중 사이즈일 땐 균등 분배로 복원)
        if (hasRestoredColorMixingCost) {
          const perEntryCost = sizeEntries.length <= 1
            ? restoredColorMixingCost
            : Math.round((restoredColorMixingCost / sizeEntries.length) / 10000) * 10000;

          sizeEntries.forEach((e: any) => {
            e.colorMixingCost = perEntryCost;
          });
        }
        
        // surface 파라미터에서 면수 정보 복원
        const surfaceParam = searchParams.get('surface');
        if (surfaceParam) {
          const decodedSurface = decodeURIComponent(surfaceParam);
          console.log('Restoring surface:', decodedSurface);
          
          // "대3*6 (920*1820): 양면" 형식 파싱
          const surfaceEntries = decodedSurface.split(', ');
          surfaceEntries.forEach(surfaceEntry => {
            const surfaceMatch = surfaceEntry.match(/(.+?):\s*(.+)/);
            if (surfaceMatch) {
              const sizeKey = surfaceMatch[1].trim();
              const surfaceValue = surfaceMatch[2].trim();
              const matchingEntry = sizeEntries.find(e => e.size === sizeKey || e.size.includes(sizeKey));
              if (matchingEntry) {
                matchingEntry.surface = surfaceValue;
              }
            }
          });
          
          setSelectedSurface(decodedSurface);
        }
        
        setSelectedSizes(sizeEntries);
        console.log('Size entries set to:', sizeEntries);
      }
      
      const colorType = searchParams.get('colorType');
      if (colorType) setSelectedColorType(colorType);
      
      // 색상 정보 복원
      const selectedColorParam = searchParams.get('selectedColor');
      if (selectedColorParam) {
        console.log('Restoring selectedColor:', selectedColorParam);
        setSelectedColor(selectedColorParam);
      }
      const selectedColorHexParam = searchParams.get('selectedColorHex');
      if (selectedColorHexParam) {
        console.log('Restoring selectedColorHex:', selectedColorHexParam);
        setSelectedColorHex(selectedColorHexParam);
      }
      const customColorNameParam = searchParams.get('customColorName');
      if (customColorNameParam) setCustomColorName(customColorNameParam);
      const customOpacityParam = searchParams.get('customOpacity');
      if (customOpacityParam) setCustomOpacity(customOpacityParam);
      
      const processing = searchParams.get('processing');
      if (processing) {
        console.log('Restoring processing:', processing);
        setSelectedProcessing(processing);
      }
      
      const quantity = searchParams.get('quantity');
      if (quantity) setQty(parseInt(quantity) || 1);
      
      // 견적 계산기 모드로 설정하고 색상 선택 단계로 이동
      setCalculatorType('quote');
      
      // 색상 선택 단계(3)로 이동하여 수정할 수 있도록 함
      if (qualityParam) {
        console.log('Moving to color selection step (3)');
        setCurrentStep(3);
      } else if (materialParam) {
        setCurrentStep(2); // 재질 선택 단계
      } else {
        setCurrentStep(1); // 소재 선택 단계
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const loadActivePricingVersion = async () => {
      try {
        const { data, error } = await (supabase.from('panel_pricing_versions' as any) as any)
          .select('id, version_name, supplier_name, effective_from')
          .eq('is_active', true)
          .order('effective_from', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.warn('Active pricing version is not available yet:', error.message);
          return;
        }

        setActivePricingVersion(data as PricingVersion | null);
      } catch (error) {
        console.warn('Failed to load active pricing version:', error);
      }
    };

    loadActivePricingVersion();
  }, []);
  
  // initialType이 있으면 자동으로 계산기 타입 선택 단계를 건너뛰기
  // 단, editMode=saved일 때는 URL 파라미터에서 복원한 step을 유지
  useEffect(() => {
    const editModeParam = searchParams.get('editMode');
    if (editModeParam === 'saved') {
      // 편집 모드일 때는 URL 파라미터 복원 useEffect에서 step을 설정하므로 여기서 건너뜀
      return;
    }
    if (initialType && calculatorType === initialType && currentStep === 0) {
      if (initialType === 'yield') {
        setCurrentStep(-1); // 수율 계산기는 -1 단계
      } else {
        setCurrentStep(1); // 견적 계산기는 1단계부터 시작
      }
    }
  }, [initialType, calculatorType, currentStep, searchParams]);
  
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
      setColorMixingCost(DEFAULT_COLOR_MIXING_COST);
      setSelectedProcessing('');
      setSelectedProcessingName('');
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
      setColorMixingCost(DEFAULT_COLOR_MIXING_COST);
      setSelectedProcessing('');
      setSelectedProcessingName('');
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
      setColorMixingCost(DEFAULT_COLOR_MIXING_COST);
      setSelectedProcessing('');
      setSelectedProcessingName('');
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
      setColorMixingCost(DEFAULT_COLOR_MIXING_COST);
      setSelectedProcessing('');
      setSelectedProcessingName('');
      setSelectedAdhesion('');
      setCurrentStep(3);
    } else if (step <= 4) {
      setSelectedThickness('');
      setSelectedSize('');
      setSelectedColorType('');
      setSelectedSurface('');
      setColorMixingCost(DEFAULT_COLOR_MIXING_COST);
      setSelectedProcessing('');
      setSelectedProcessingName('');
      setSelectedAdhesion('');
      setCurrentStep(4);
    } else if (step <= 5) {
      setSelectedSize('');
      setSelectedColorType('');
      setSelectedSurface('');
      setColorMixingCost(DEFAULT_COLOR_MIXING_COST);
      setSelectedProcessing('');
      setSelectedProcessingName('');
      setSelectedAdhesion('');
      setCurrentStep(5);
    } else if (step <= 6) {
      setSelectedSurface('');
      setColorMixingCost(DEFAULT_COLOR_MIXING_COST);
      setSelectedProcessing('');
      setSelectedProcessingName('');
      setSelectedAdhesion('');
      setCurrentStep(6);
    } else if (step <= 7) {
      setColorMixingCost(DEFAULT_COLOR_MIXING_COST);
      setSelectedProcessing('');
      setSelectedProcessingName('');
      setSelectedAdhesion('');
      setCurrentStep(7);
    } else if (step <= 8) {
      // 가공 선택 단계 리셋 (수량/복잡도 포함)
      setQty(1);
      setIsComplex(false);
      setSelectedProcessing('');
      setSelectedProcessingName('');
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

    // 공간 프로젝트는 별도 폼으로 이동 (기존 견적 흐름과 분리)
    if (material.id === 'space-project') {
      navigate('/space-quote');
      return;
    }

    setSelectedMaterial(material);
    
    // 제품 제작 모드일 경우 수동 입력 단계로 이동
    if (material.id === 'manual-product') {
      setManualProductItems([{ 
        id: Date.now().toString(), 
        itemNumber: '', 
        name: '', 
        quantity: 1, 
        unitPrice: 0,
        sizeWidth: '',
        sizeHeight: '',
        sizeDepth: '',
        material: '',
        thickness: '',
        color: '',
        colorHex: '',
        surfaceType: '',
        notes: ''
      }]);
      setCurrentStep(100); // 제품 제작 전용 단계
      return;
    }
    
    resetFromStep(2);
    setCurrentStep(2);
  };
  const handleQualitySelect = (quality: Quality) => {
    console.log('Quality selected:', quality);
    setSelectedQuality(quality);
    setYieldAppliedSelection(null);
    resetFromStep(3);
    setCurrentStep(3);
  };
  const handleColorSelect = (colorId: string, colorInfo?: {
    acCode: string;
    hexCode: string;
    customColorName?: string;
    customOpacity?: string;
    isBrightPigment?: boolean;
  }) => {
    console.log('Color selected:', colorId, colorInfo);
    if (colorInfo) {
      setSelectedColor(colorInfo.acCode);
      setSelectedColorHex(colorInfo.hexCode);
      setCustomColorName(colorInfo.customColorName || '');
      setCustomOpacity(colorInfo.customOpacity || '');
      setSelectedColorType(colorInfo.isBrightPigment ? '브라이트/진백/스리' : '');
    } else {
      setSelectedColor(colorId);
    }

    if (yieldAppliedSelection) {
      setCurrentStep(3);
      return;
    }
    
    // 편집 모드에서는 기존 두께/사이즈/면수/조색비/가공 데이터를 유지하고 두께 선택 단계로 이동
    if (editMode === 'saved' && selectedThickness && selectedSize) {
      setCurrentStep(4);
    } else {
      resetFromStep(4);
      setCurrentStep(4);
    }
  };
  const handleThicknessSelect = (thickness: string) => {
    console.log('Thickness selected:', thickness);
    setSelectedThickness(thickness);
    // 편집 모드에서는 기존 사이즈/면수/조색비 데이터를 유지
    if (editMode === 'saved' && selectedSize) {
      setCurrentStep(5);
    } else {
      resetFromStep(5);
      setCurrentStep(5);
    }
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
    // 편집 모드에서는 면수/조색비/가공 선택값을 유지
    if (editMode !== 'saved') {
      resetFromStep(6);
    }
    setCurrentStep(6);
  };
  const handleSurfaceSelect = (surface: string) => {
    console.log('Surface selected:', surface);
    setSelectedSurface(surface);
    
    // 필름 아크릴의 경우 조색비를 기본 40000원으로 설정
    if (selectedQuality?.id === 'film-acrylic') {
      setColorMixingCost(DEFAULT_COLOR_MIXING_COST);
    }
    
    resetFromStep(7);
    setCurrentStep(7);
  };

  const handleNextFromMultipleSurface = () => {
    // 편집 모드에서는 가공 선택값을 유지
    if (editMode !== 'saved') {
      resetFromStep(7);
    }
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
  const handleProcessingSelect = (processingId: string, processingName?: string) => {
    console.log('Processing selected:', processingId, processingName);
    setSelectedProcessing(processingId);
    if (processingName) {
      setSelectedProcessingName(processingName);
    }
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

  const createCalculationSnapshot = (
    breakdown: { label: string; price: number }[],
    totalPrice: number,
    extraOptions: Record<string, unknown> = {}
  ) => ({
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    pricingVersion: activePricingVersion ? {
      id: activePricingVersion.id,
      versionName: activePricingVersion.version_name,
      supplierName: activePricingVersion.supplier_name,
      effectiveFrom: activePricingVersion.effective_from,
    } : null,
    selectedOptions: {
      factory: 'jangwon',
      materialId: selectedMaterial?.id,
      materialName: selectedMaterial?.name,
      qualityId: selectedQuality?.id,
      qualityName: selectedQuality?.name,
      thickness: selectedThickness,
      sizes: selectedSizes.map(s => ({
        size: s.size,
        quantity: s.quantity,
        surface: s.surface,
        colorMixingCost: s.colorMixingCost || 0,
      })),
      colorType: selectedColorType,
      selectedColor,
      selectedColorHex,
      customColorName,
      customOpacity,
      processing: selectedProcessing,
      processingName: selectedProcessingName || PROCESSING_OPTIONS.find(p => p.id === selectedProcessing)?.name || '',
      additionalOptions: selectedAdditionalOptions,
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
      mugwangPainting,
      ...extraOptions,
    },
    breakdown: breakdown.map(item => ({ ...item })),
    totalPrice,
    note: '저장 당시 단가와 계산 근거입니다. 이후 단가표 변경은 이 견적 금액에 자동 반영되지 않습니다.',
  });

  const handleAddQuote = async () => {
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

    const processingName = selectedProcessingName || PROCESSING_OPTIONS.find(p => p.id === selectedProcessing)?.name || '';
    
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
      customColorName: customColorName,
      customOpacity: customOpacity,
      surface: selectedSizes.map(s => `${s.size}: ${s.surface}`).join(', '),
      colorMixingCost: selectedSizes.reduce((sum, s) => sum + (s.colorMixingCost || 0), 0),
      processing: selectedProcessing,
      processingName: processingName,
      totalPrice: priceInfo.totalPrice,
      quantity: 1,
      breakdown: priceInfo.breakdown,
      pricingVersionId: activePricingVersion?.id || null,
      pricingVersionName: activePricingVersion?.version_name || '미지정 단가표',
      quoteStyle: 'panel' as const,
      calculationSnapshot: createCalculationSnapshot(priceInfo.breakdown, priceInfo.totalPrice)
    };

    // 편집 모드일 때: 저장된 견적서의 해당 항목을 업데이트
    if (editMode === 'saved' && savedQuoteId && itemIndex !== null) {
      try {
        // 기존 견적서 데이터 가져오기
        const { data: existingQuote, error: fetchError } = await supabase
          .from('saved_quotes')
          .select('items, subtotal, tax, total, quote_number, project_name, recipient_company, recipient_name, recipient_phone, recipient_email, recipient_address, recipient_memo, quote_date_display, valid_until, delivery_period, payment_condition, desired_delivery_date, issuer_name, issuer_email, issuer_phone, attachments, user_id')
          .eq('id', savedQuoteId)
          .single();

        if (fetchError) throw fetchError;

        // items 배열 업데이트
        const items: any[] = Array.isArray(existingQuote.items) ? [...existingQuote.items] : [];
        if (itemIndex >= 0 && itemIndex < items.length) {
          const existingItem = items[itemIndex] as any;
          items[itemIndex] = {
            ...existingItem,
            ...quoteData,
            id: existingItem?.id // 기존 ID 유지
          };
        }

        // 총액 재계산
        const newSubtotal = items.reduce((sum: number, item: any) => sum + (item.totalPrice * (item.quantity || 1)), 0);
        const roundedSubtotal = Math.round(newSubtotal / 100) * 100;
        const newTax = Math.round(roundedSubtotal * 0.1);
        const newTotal = roundedSubtotal + newTax;

        // 저장된 견적서 업데이트
        const { error: updateError } = await supabase
          .from('saved_quotes')
          .update({
            items,
            subtotal: roundedSubtotal,
            tax: newTax,
            total: newTotal,
            pricing_version_id: activePricingVersion?.id || null,
            calculation_snapshot: {
              schemaVersion: 1,
              capturedAt: new Date().toISOString(),
              pricingVersionId: activePricingVersion?.id || null,
              pricingVersionName: activePricingVersion?.version_name || '미지정 단가표',
              items: items.map(item => ({
                id: item.id,
                totalPrice: item.totalPrice,
                quantity: item.quantity || 1,
                calculationSnapshot: item.calculationSnapshot || null,
              })),
            },
          })
          .eq('id', savedQuoteId);

        if (updateError) throw updateError;

        alert('견적 항목이 수정되었습니다!');
        
        // 편집 모드 초기화 및 저장된 견적서 상세 페이지로 이동
        setEditMode(null);
        setSavedQuoteId(null);
        setItemIndex(null);
        navigate(`/saved-quotes/${savedQuoteId}`);
        return;
      } catch (error) {
        console.error('Error updating saved quote:', error);
        alert('견적 수정에 실패했습니다.');
        return;
      }
    }

    // 기존 발행 견적서에 새 항목 추가 모드
    if (editMode === 'addToSaved' && savedQuoteId) {
      try {
        const { data: existingQuote, error: fetchError } = await supabase
          .from('saved_quotes')
          .select('items, subtotal, tax, total')
          .eq('id', savedQuoteId)
          .single();

        if (fetchError) throw fetchError;

        const items: any[] = Array.isArray(existingQuote.items) ? [...existingQuote.items] : [];
        items.push({
          ...quoteData,
          id: Date.now().toString(),
          createdAt: new Date().toISOString()
        });

        const newSubtotal = items.reduce((sum: number, item: any) => sum + (item.totalPrice * (item.quantity || 1)), 0);
        const roundedSubtotal = Math.round(newSubtotal / 100) * 100;
        const newTax = Math.round(roundedSubtotal * 0.1);
        const newTotal = roundedSubtotal + newTax;

        const { error: updateError } = await supabase
          .from('saved_quotes')
          .update({
            items,
            subtotal: roundedSubtotal,
            tax: newTax,
            total: newTotal,
            pricing_version_id: activePricingVersion?.id || null,
            calculation_snapshot: {
              schemaVersion: 1,
              capturedAt: new Date().toISOString(),
              pricingVersionId: activePricingVersion?.id || null,
              pricingVersionName: activePricingVersion?.version_name || '미지정 단가표',
              items: items.map(item => ({
                id: item.id,
                totalPrice: item.totalPrice,
                quantity: item.quantity || 1,
                calculationSnapshot: item.calculationSnapshot || null,
              })),
            },
          })
          .eq('id', savedQuoteId);

        if (updateError) throw updateError;

        alert('새 견적 항목이 추가되었습니다!');
        setEditMode(null);
        setSavedQuoteId(null);
        navigate(`/saved-quotes/${savedQuoteId}`);
        return;
      } catch (error) {
        console.error('Error adding item to saved quote:', error);
        alert('견적 항목 추가에 실패했습니다.');
        return;
      }
    }

    // 일반 모드: 새 견적 추가
    addQuote(quoteData);

    // Reset form for new quote - 모든 상태 초기화
    setCurrentStep(0);
    setCalculatorType(null);
    setSelectedMaterial(null);
    setSelectedQuality(null);
    setSelectedColor('');
    setSelectedColorHex('');
    setSelectedThickness('');
    setSelectedSize('');
    setSelectedSizes([]);
    setYieldAppliedSelection(null);
    setSelectedColorType('');
    setCustomColorName('');
    setCustomOpacity('');
    setSelectedSurface('');
    setColorMixingCost(DEFAULT_COLOR_MIXING_COST);
    setSelectedProcessing('');
    setSelectedProcessingName('');
    setSelectedAdhesion('');
    setSelectedFilm('');
    setSelectedBaseType('');
    // 고급 옵션 초기화
    setQty(1);
    setIsComplex(false);
    setBevelLengthM(0);
    setLaserHoles(0);
    setCorners90(0);
    setUseDetailedBond(false);
    setJoinLengthM(0);
    setTrayHeightMm(undefined);
    setEdgeFinishing(false);
    setBulgwang(false);
    setTapung(false);
    setMugwangPainting(false);
    setSelectedAdditionalOptions({});
    alert('견적이 추가되었습니다!');
  };

  // 제품 제작 수동 입력 견적 추가
  const handleAddManualProductQuote = async () => {
    if (manualProductItems.length === 0) {
      alert('최소 1개 이상의 항목을 입력해주세요.');
      return;
    }

    const validItems = manualProductItems.filter(item => 
      item.name.trim() !== '' && item.quantity > 0 && item.unitPrice > 0
    );

    if (validItems.length === 0) {
      alert('유효한 항목을 입력해주세요.');
      return;
    }

    // 각 항목의 quoteData 생성
    const quoteDataList = validItems.map(item => {
      const sizeParts = [item.sizeWidth, item.sizeHeight, item.sizeDepth].filter(p => p.trim());
      const sizeStr = sizeParts.length > 0 ? sizeParts.join(' × ') : '-';
      
      const breakdownItems: { label: string; price: number }[] = item.calculationBreakdown?.length
        ? item.calculationBreakdown.map(entry => ({ ...entry }))
        : [
            { label: `${item.name} (${item.quantity}개 × ₩${item.unitPrice.toLocaleString()})`, price: item.unitPrice * item.quantity }
          ];
      
      if (item.notes.trim()) {
        breakdownItems.push({ label: `기타: ${item.notes}`, price: 0 });
      }

      return {
        factory: 'jangwon',
        material: '제품 제작',
        quality: item.material || '-',
        thickness: item.thickness || '-',
        size: sizeStr,
        colorType: item.color || '',
        selectedColor: item.color || '',
        selectedColorHex: item.colorHex || '',
        customColorName: '',
        customOpacity: '',
        surface: item.surfaceType || '-',
        colorMixingCost: 0,
        processing: 'manual',
        processingName: `${item.itemNumber ? `[${item.itemNumber}] ` : ''}${item.name}`,
        totalPrice: item.unitPrice * item.quantity,
        quantity: 1,
        breakdown: breakdownItems,
        pricingVersionId: activePricingVersion?.id || null,
        pricingVersionName: activePricingVersion?.version_name || '미지정 단가표',
        quoteStyle: 'fabrication' as const,
        calculationSnapshot: createCalculationSnapshot(
          breakdownItems,
          item.unitPrice * item.quantity,
          {
            manualProductItem: { ...item },
            pricingMeta: item.pricingMeta || null,
          }
        )
      };
    });

    // 기존 발행 견적서에 새 항목 추가 모드
    if (editMode === 'addToSaved' && savedQuoteId) {
      try {
        const { data: existingQuote, error: fetchError } = await supabase
          .from('saved_quotes')
          .select('items, subtotal, tax, total')
          .eq('id', savedQuoteId)
          .single();

        if (fetchError) throw fetchError;

        const items: any[] = Array.isArray(existingQuote.items) ? [...existingQuote.items] : [];
        quoteDataList.forEach(qd => {
          items.push({
            ...qd,
            id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
            createdAt: new Date().toISOString()
          });
        });

        const newSubtotal = items.reduce((sum: number, item: any) => sum + (item.totalPrice * (item.quantity || 1)), 0);
        const roundedSubtotal = Math.round(newSubtotal / 100) * 100;
        const newTax = Math.round(roundedSubtotal * 0.1);
        const newTotal = roundedSubtotal + newTax;

        const { error: updateError } = await supabase
          .from('saved_quotes')
          .update({
            items,
            subtotal: roundedSubtotal,
            tax: newTax,
            total: newTotal,
            pricing_version_id: activePricingVersion?.id || null,
            calculation_snapshot: {
              schemaVersion: 1,
              capturedAt: new Date().toISOString(),
              pricingVersionId: activePricingVersion?.id || null,
              pricingVersionName: activePricingVersion?.version_name || '미지정 단가표',
              items: items.map(item => ({
                id: item.id,
                totalPrice: item.totalPrice,
                quantity: item.quantity || 1,
                calculationSnapshot: item.calculationSnapshot || null,
              })),
            },
          })
          .eq('id', savedQuoteId);

        if (updateError) throw updateError;

        alert(`${validItems.length}개의 제품 제작 항목이 견적서에 추가되었습니다!`);
        setEditMode(null);
        setSavedQuoteId(null);
        setManualProductItems([]);
        setSelectedMaterial(null);
        setCurrentStep(0);
        setCalculatorType(null);
        navigate(`/saved-quotes/${savedQuoteId}`);
        return;
      } catch (error) {
        console.error('Error adding manual items to saved quote:', error);
        alert('견적 항목 추가에 실패했습니다.');
        return;
      }
    }

    // 일반 모드: 새 견적 추가
    quoteDataList.forEach(qd => addQuote(qd));

    // 리셋
    setManualProductItems([]);
    setSelectedMaterial(null);
    setCurrentStep(0);
    setCalculatorType(null);
    
    alert(`${validItems.length}개의 제품 제작 견적이 추가되었습니다!`);
  };

  // 제품 제작에서 견적 요약으로 이동
  const handleManualProductNext = () => {
    handleAddManualProductQuote();
  };

  const handleViewQuotesSummary = () => {
    navigate('/quotes-summary');
  };
  const handlePanelSelectFromYield = (panelData: {
    quality: string;
    thickness: string;
    size: string;
    quantity: number;
    panels?: Array<{ size: string; quantity: number }>;
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

    const yieldSizes = (panelData.panels && panelData.panels.length > 0
      ? panelData.panels
      : [{ size: panelData.size, quantity: panelData.quantity }]
    ).map(panel => ({
      size: panel.size,
      quantity: panel.quantity,
      surface: '',
      colorMixingCost: DEFAULT_COLOR_MIXING_COST,
    }));

    // 두께와 사이즈 설정. 컬러는 견적계산기 순서에 맞춰 사용자가 다음 단계에서 선택합니다.
    setSelectedThickness(panelData.thickness);
    setSelectedSize(panelData.size);
    setSelectedSizes(yieldSizes);
    setSelectedColor('');
    setSelectedColorHex('');
    setSelectedColorType('');
    setSelectedSurface('');
    setColorMixingCost(DEFAULT_COLOR_MIXING_COST);
    setSelectedProcessing('');
    setSelectedProcessingName('');
    setSelectedAdhesion('');
    setYieldAppliedSelection({
      thickness: panelData.thickness,
      sizes: yieldSizes,
    });

    // 견적계산기 모드로 전환하고 컬러 선택 단계로 이동
    setCalculatorType('quote');
    setCurrentStep(3);
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
              <span className="skeuo-engraved">ACBANK</span>{" "}
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
              <StepIndicator currentStep={currentStep} maxSteps={maxSteps} />
          
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

          {/* Step 100: 제품 제작 수동 입력 */}
          {currentStep === 100 && selectedMaterial?.id === 'manual-product' && (
            <ManualProductEntry
              items={manualProductItems}
              onItemsChange={setManualProductItems}
              onNext={handleManualProductNext}
            />
          )}

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
                  initialCustomColor={selectedColorHex}
                  initialCustomColorName={customColorName}
                  initialCustomOpacity={customOpacity}
                />
              )}
              {editMode === 'saved' && selectedColor && (
                <div className="pt-4">
                  <Button
                    onClick={() => setCurrentStep(4)}
                    size="lg"
                    className="w-full text-base font-semibold"
                  >
                    다음 단계로 (기존 색상 유지)
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              )}
              {yieldAppliedSelection && selectedColor && (
                <div className="pt-4 space-y-3">
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                    수율계산 추천 원판을 적용했습니다: {yieldAppliedSelection.thickness} · {' '}
                    {yieldAppliedSelection.sizes.map(s => `${s.size} ${s.quantity}장`).join(', ')}
                  </div>
                  <Button
                    onClick={() => setCurrentStep(6)}
                    size="lg"
                    className="w-full text-base font-semibold"
                  >
                    추천 원판 유지하고 면수 선택으로
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Step 4: 두께 선택 */}
          {currentStep === 4 && selectedColor && (
            <>
              <ThicknessSelection thicknesses={selectedQuality.thicknesses} selectedThickness={selectedThickness} onThicknessSelect={handleThicknessSelect} />
              {editMode === 'saved' && selectedThickness && (
                <div className="pt-4">
                  <Button
                    onClick={() => setCurrentStep(5)}
                    size="lg"
                    className="w-full text-base font-semibold"
                  >
                    다음 단계로 (기존 두께 유지)
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              )}
            </>
          )}

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

          {/* 견적 추가/수정 버튼 */}
          {((currentStep === 8 && selectedQuality?.id !== 'film-acrylic' && selectedSizes.length > 0) ||
            (currentStep === 9 && selectedQuality?.id === 'film-acrylic' && selectedSizes.length > 0)) && (
            <>
              <Separator className="my-8" />
              <div className="flex justify-center gap-4">
                <Button onClick={handleAddQuote} size="lg" className={`px-8 animate-fade-up ${(editMode === 'saved' || editMode === 'addToSaved') ? 'bg-green-600 hover:bg-green-700' : ''}`}>
                  <Plus className="w-5 h-5" />
                  {editMode === 'saved' ? '견적 수정' : editMode === 'addToSaved' ? '견적서에 항목 추가' : '견적 추가'}
                </Button>
                {(editMode === 'saved' || editMode === 'addToSaved') && savedQuoteId && (
                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={() => {
                      setEditMode(null);
                      setSavedQuoteId(null);
                      setItemIndex(null);
                      navigate(`/saved-quotes/${savedQuoteId}`);
                    }}
                    className="px-8"
                  >
                    취소
                  </Button>
                )}
              </div>
            </>
          )}

          {/* 이전 단계로 돌아가기 버튼 */}
          {currentStep > 0 && currentStep !== 100 && <>
              <Separator className="my-8" />
              <div className="flex justify-center">
                <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)} className="px-6">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  이전 단계로
                </Button>
              </div>
            </>}
          
          {/* 제품 제작 모드에서 이전 단계로 버튼 */}
          {currentStep === 100 && <>
              <Separator className="my-8" />
              <div className="flex justify-center">
                <Button variant="ghost" onClick={() => {
                  setManualProductItems([]);
                  setSelectedMaterial(null);
                  setCurrentStep(1);
                }} className="px-6">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  소재 선택으로
                </Button>
              </div>
            </>}
            </>}
        </CardContent>
      </Card>
    </div>;
};
export default PanelCalculator;
