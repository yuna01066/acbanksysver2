import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ArrowRight, Calculator, Plus, ShoppingCart } from "lucide-react";
import { MATERIALS, CASTING_QUALITIES, OTHER_ACRYLIC_QUALITIES, Material, Quality } from "@/types/calculator";
import ProcessingOptions from "./ProcessingOptions";
import ColorMixingStep from "./ColorMixingStep";
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
import { useQuotes, type Quote } from "@/contexts/QuoteContext";
import { usePriceCalculation } from "@/hooks/usePriceCalculation";
import { Input } from "@/components/ui/input";
import YieldCalculator from "./YieldCalculator";
import type { YieldRecommendationSnapshot } from "./UnifiedRecommendations";
import AdvancedProcessingOptions from "./AdvancedProcessingOptions";
import EdgeFinishingOption from "./EdgeFinishingOption";
import ManualProductEntry, { ManualProductItem } from "./ManualProductEntry";
import type { Database } from '@/integrations/supabase/types';
import { formatPricingVersionDisplayName } from '@/utils/pricingVersionDisplay';
import { createQuoteItemId, normalizeQuoteItems } from '@/utils/quoteItemIdentity';

const DEFAULT_COLOR_MIXING_COST = 40000;
const CALCULATOR_RECOVERY_STORAGE_KEY = 'acbank_calculator_recovery_v1';

type PricingVersion = Pick<
  Database['public']['Tables']['panel_pricing_versions']['Row'],
  'id' | 'version_name' | 'supplier_name' | 'effective_from'
>;

type QuoteDraft = Omit<Quote, 'id' | 'createdAt'>;

type SavedQuoteItem = Partial<QuoteDraft> & {
  id?: string;
  createdAt?: string | Date;
  totalPrice?: number;
  quantity?: number;
  calculationSnapshot?: Quote['calculationSnapshot'] | null;
  [key: string]: unknown;
};

type CalculatorRecoveryDraft = {
  version: 1;
  savedAt: string;
  state: {
    currentStep: number;
    calculatorType: 'quote' | 'yield';
    selectedMaterialId: string | null;
    selectedQualityId: string | null;
    selectedThickness: string;
    selectedSize: string;
    selectedSizes: SizeQuantitySelection[];
    selectedColor: string;
    selectedColorHex: string;
    selectedColorType: string;
    customColorName: string;
    customOpacity: string;
    selectedSurface: string;
    colorMixingCost: number;
    selectedProcessing: string;
    selectedProcessingName: string;
    selectedAdhesion: string;
    selectedFilm: string;
    selectedBaseType: string;
    qty: number;
    isComplex: boolean;
    polishedEdgeLengthMm: number;
    edgeFinishing: boolean;
    bulgwang: boolean;
    tapung: boolean;
    mugwangPainting: boolean;
    selectedAdditionalOptions: Record<string, number>;
    manualProductItems: ManualProductItem[];
    editMode: string | null;
    savedQuoteId: string | null;
    draftQuoteId: string | null;
    savedQuoteItemId: string | null;
    legacyItemIndex: number | null;
  };
};

const toSavedQuoteItems = (items: unknown): SavedQuoteItem[] => {
  if (!Array.isArray(items)) return [];

  return normalizeQuoteItems(items
    .filter((item): item is Record<string, unknown> => (
      Boolean(item) && typeof item === 'object' && !Array.isArray(item)
    ))
    .map(item => ({ ...item } as SavedQuoteItem)));
};

const calculateSavedQuoteSubtotal = (items: SavedQuoteItem[]) => (
  items.reduce((sum, item) => {
    const totalPrice = Number(item.totalPrice) || 0;
    const quantity = Number(item.quantity) || 1;
    return sum + (totalPrice * quantity);
  }, 0)
);

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

const PanelCalculator = ({ initialType = 'quote' }: PanelCalculatorProps) => {
  const navigate = useNavigate();
  const [rawSearchParams] = useSearchParams();
  const searchKey = rawSearchParams.toString();
  const searchParams = useMemo(() => new URLSearchParams(searchKey), [searchKey]);
  const resolvedInitialType: 'quote' | 'yield' = initialType === 'yield' ? 'yield' : 'quote';
  const {
    addQuote,
    updateQuote,
    quotes
  } = useQuotes();
  const [currentStep, setCurrentStep] = useState(resolvedInitialType === 'yield' ? -1 : 1);
  const [calculatorType, setCalculatorType] = useState<'quote' | 'yield'>(resolvedInitialType);
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
  const [isProcessingSelectionComplete, setIsProcessingSelectionComplete] = useState<boolean>(false);
  const [selectedFilm, setSelectedFilm] = useState<string>('');
  const [selectedBaseType, setSelectedBaseType] = useState<string>(''); // 필름 아크릴 기본 재질 (Clear/Bright/Astel)
  const [activePricingVersion, setActivePricingVersion] = useState<PricingVersion | null>(null);
  
  // 편집 모드 관련 상태
  const [editMode, setEditMode] = useState<string | null>(null);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [draftQuoteId, setDraftQuoteId] = useState<string | null>(null);
  const [savedQuoteItemId, setSavedQuoteItemId] = useState<string | null>(null);
  const [legacyItemIndex, setLegacyItemIndex] = useState<number | null>(null);
  const [pendingRecoveryDraft, setPendingRecoveryDraft] = useState<CalculatorRecoveryDraft | null>(null);
  const skipRecoveryPromptRef = useRef(false);
  const restoredSearchKeyRef = useRef<string | null>(null);
  
  // 고급 옵션 상태
  const [qty, setQty] = useState<number>(1);
  const [isComplex, setIsComplex] = useState<boolean>(false);
  const [bevelLengthM, setBevelLengthM] = useState<number>(0);
  const [polishedEdgeLengthMm, setPolishedEdgeLengthMm] = useState<number>(0);
  const [laserHoles, setLaserHoles] = useState<number>(0);
  const [edgeFinishing, setEdgeFinishing] = useState<boolean>(false);
  const [bulgwang, setBulgwang] = useState<boolean>(false);
  const [tapung, setTapung] = useState<boolean>(false);
  const [mugwangPainting, setMugwangPainting] = useState<boolean>(false);
  const [selectedAdditionalOptions, setSelectedAdditionalOptions] = useState<Record<string, number>>({});
  const [yieldAppliedSelection, setYieldAppliedSelection] = useState<{
    thickness: string;
    sizes: SizeQuantitySelection[];
    yieldRecommendation?: YieldRecommendationSnapshot;
  } | null>(null);
  
  // 제품 제작 수동 입력 상태
  const [manualProductItems, setManualProductItems] = useState<ManualProductItem[]>([]);

  const hasRecoverableCalculatorState = () => (
    currentStep > 1
    || calculatorType !== resolvedInitialType
    || Boolean(selectedMaterial)
    || Boolean(selectedQuality)
    || Boolean(selectedThickness)
    || Boolean(selectedSize)
    || selectedSizes.length > 0
    || Boolean(selectedColor)
    || Boolean(selectedColorHex)
    || Boolean(selectedProcessing)
    || manualProductItems.length > 0
    || Boolean(editMode)
    || Boolean(savedQuoteId)
    || Boolean(draftQuoteId)
    || Boolean(savedQuoteItemId)
  );

  const buildCalculatorRecoveryDraft = (): CalculatorRecoveryDraft => ({
    version: 1,
    savedAt: new Date().toISOString(),
    state: {
      currentStep,
      calculatorType,
      selectedMaterialId: selectedMaterial?.id || null,
      selectedQualityId: selectedQuality?.id || null,
      selectedThickness,
      selectedSize,
      selectedSizes,
      selectedColor,
      selectedColorHex,
      selectedColorType,
      customColorName,
      customOpacity,
      selectedSurface,
      colorMixingCost,
      selectedProcessing,
      selectedProcessingName,
      selectedAdhesion,
      selectedFilm,
      selectedBaseType,
      qty,
      isComplex,
      polishedEdgeLengthMm,
      edgeFinishing,
      bulgwang,
      tapung,
      mugwangPainting,
      selectedAdditionalOptions,
      manualProductItems,
      editMode,
      savedQuoteId,
      draftQuoteId,
      savedQuoteItemId,
      legacyItemIndex,
    },
  });

  const saveCalculatorRecoveryDraft = () => {
    if (typeof window === 'undefined') return;

    if (!hasRecoverableCalculatorState()) {
      window.localStorage.removeItem(CALCULATOR_RECOVERY_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(CALCULATOR_RECOVERY_STORAGE_KEY, JSON.stringify(buildCalculatorRecoveryDraft()));
  };

  const clearCalculatorRecoveryDraft = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CALCULATOR_RECOVERY_STORAGE_KEY);
    }
    setPendingRecoveryDraft(null);
  };

  const applyCalculatorRecoveryDraft = (draft: CalculatorRecoveryDraft) => {
    const state = draft.state;
    const allQualities = [...CASTING_QUALITIES, ...OTHER_ACRYLIC_QUALITIES];
    const material = state.selectedMaterialId
      ? MATERIALS.find(candidate => candidate.id === state.selectedMaterialId) || null
      : null;
    const quality = state.selectedQualityId
      ? allQualities.find(candidate => candidate.id === state.selectedQualityId) || null
      : null;

    skipRecoveryPromptRef.current = true;
    setCurrentStep(state.currentStep);
    setCalculatorType(state.calculatorType);
    setSelectedMaterial(material);
    setSelectedQuality(quality);
    setSelectedThickness(state.selectedThickness);
    setSelectedSize(state.selectedSize);
    setSelectedSizes(Array.isArray(state.selectedSizes) ? state.selectedSizes : []);
    setSelectedColor(state.selectedColor);
    setSelectedColorHex(state.selectedColorHex);
    setSelectedColorType(state.selectedColorType);
    setCustomColorName(state.customColorName);
    setCustomOpacity(state.customOpacity);
    setSelectedSurface(state.selectedSurface);
    setColorMixingCost(Number(state.colorMixingCost) || DEFAULT_COLOR_MIXING_COST);
    setSelectedProcessing(state.selectedProcessing);
    setSelectedProcessingName(state.selectedProcessingName);
    setSelectedAdhesion(state.selectedAdhesion);
    setSelectedFilm(state.selectedFilm);
    setSelectedBaseType(state.selectedBaseType);
    setQty(Number(state.qty) || 1);
    setIsComplex(Boolean(state.isComplex));
    setPolishedEdgeLengthMm(Number(state.polishedEdgeLengthMm) || 0);
    setEdgeFinishing(Boolean(state.edgeFinishing));
    setBulgwang(Boolean(state.bulgwang));
    setTapung(Boolean(state.tapung));
    setMugwangPainting(Boolean(state.mugwangPainting));
    setSelectedAdditionalOptions(state.selectedAdditionalOptions || {});
    setManualProductItems(Array.isArray(state.manualProductItems) ? state.manualProductItems : []);
    setEditMode(state.editMode);
    setSavedQuoteId(state.savedQuoteId);
    setDraftQuoteId(state.draftQuoteId);
    setSavedQuoteItemId(state.savedQuoteItemId);
    setLegacyItemIndex(state.legacyItemIndex);
    setPendingRecoveryDraft(null);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || skipRecoveryPromptRef.current) return;
    if (searchParams.get('editMode') || searchParams.get('addToQuote') || searchParams.get('channelLeadId')) return;

    try {
      const raw = window.localStorage.getItem(CALCULATOR_RECOVERY_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as CalculatorRecoveryDraft;
      const savedAt = new Date(parsed.savedAt);
      const isFresh = !Number.isNaN(savedAt.getTime()) && Date.now() - savedAt.getTime() < 1000 * 60 * 60 * 24;

      if (parsed.version === 1 && parsed.state && isFresh) {
        setPendingRecoveryDraft(parsed);
      } else {
        window.localStorage.removeItem(CALCULATOR_RECOVERY_STORAGE_KEY);
      }
    } catch (error) {
      console.warn('Failed to parse calculator recovery draft:', error);
      window.localStorage.removeItem(CALCULATOR_RECOVERY_STORAGE_KEY);
    }
  }, [searchKey, searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pendingRecoveryDraft) return;

    const timer = window.setTimeout(saveCalculatorRecoveryDraft, 500);
    const saveOnHide = () => {
      if (document.visibilityState === 'hidden') saveCalculatorRecoveryDraft();
    };
    const saveOnPageExit = () => saveCalculatorRecoveryDraft();

    document.addEventListener('visibilitychange', saveOnHide);
    window.addEventListener('pagehide', saveOnPageExit);
    window.addEventListener('beforeunload', saveOnPageExit);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', saveOnHide);
      window.removeEventListener('pagehide', saveOnPageExit);
      window.removeEventListener('beforeunload', saveOnPageExit);
    };
  }, [
    currentStep,
    calculatorType,
    selectedMaterial,
    selectedQuality,
    selectedThickness,
    selectedSize,
    selectedSizes,
    selectedColor,
    selectedColorHex,
    selectedColorType,
    customColorName,
    customOpacity,
    selectedSurface,
    colorMixingCost,
    selectedProcessing,
    selectedProcessingName,
    selectedAdhesion,
    selectedFilm,
    selectedBaseType,
    qty,
    isComplex,
    polishedEdgeLengthMm,
    edgeFinishing,
    bulgwang,
    tapung,
    mugwangPainting,
    selectedAdditionalOptions,
    manualProductItems,
    editMode,
    savedQuoteId,
    draftQuoteId,
    savedQuoteItemId,
    legacyItemIndex,
    pendingRecoveryDraft,
  ]);
  
  // URL 파라미터에서 편집 데이터 복원
  useEffect(() => {
    const restoreKey = searchKey || '__calculator_default__';
    if (restoredSearchKeyRef.current === restoreKey) return;

    // addToQuote 모드: 기존 발행 견적서에 새 항목 추가
    const addToQuoteId = searchParams.get('addToQuote');
    if (addToQuoteId) {
      setEditMode('addToSaved');
      setSavedQuoteId(addToQuoteId);
      setSavedQuoteItemId(null);
      setLegacyItemIndex(null);
      restoredSearchKeyRef.current = restoreKey;
      return;
    }

    // 채널톡 분석 리드에서 견적 초안으로 진입한 경우
    const channelLeadId = searchParams.get('channelLeadId');
    if (channelLeadId) {
      setCalculatorType('quote');

      const materialParam = searchParams.get('material') || '';
      if (/아크릴|acrylic/i.test(materialParam)) {
        const acrylicMaterial = MATERIALS.find(m => m.id === 'acrylic' || /아크릴/.test(m.name));
        if (acrylicMaterial) setSelectedMaterial(acrylicMaterial);
      }

      const thicknessParam = searchParams.get('thickness');
      if (thicknessParam) {
        const thicknessMatch = thicknessParam.match(/\d+(?:\.\d+)?\s*T/i);
        setSelectedThickness(thicknessMatch ? thicknessMatch[0].replace(/\s+/g, '').toUpperCase() : thicknessParam);
      }

      const quantityParam = Number(searchParams.get('quantity'));
      if (Number.isFinite(quantityParam) && quantityParam > 0) setQty(quantityParam);

      const selectedColorParam = searchParams.get('selectedColor');
      if (selectedColorParam) setSelectedColor(selectedColorParam);

      setCurrentStep(materialParam ? 2 : 1);
      restoredSearchKeyRef.current = restoreKey;
      return;
    }

    const editModeParam = searchParams.get('editMode');
    if (editModeParam === 'saved' || editModeParam === 'draft') {
      console.log('Edit mode detected, restoring quote data from URL params');
      console.log('All URL params:', Object.fromEntries(searchParams.entries()));

      if (editModeParam === 'draft') {
        const draftQuoteIdParam = searchParams.get('draftQuoteId');
        const draftQuoteExists = draftQuoteIdParam
          ? quotes.some(quote => quote.id === draftQuoteIdParam)
          : false;

        if (!draftQuoteIdParam || !draftQuoteExists) {
          // Draft items may still be hydrating from the quote draft store. Do not
          // bounce away from the calculator before that restore has a chance to finish.
          if (draftQuoteIdParam && quotes.length === 0) return;
          toast.error('수정할 임시 견적 항목을 찾을 수 없습니다.');
          restoredSearchKeyRef.current = restoreKey;
          return;
        }

        setEditMode(editModeParam);
        setDraftQuoteId(draftQuoteIdParam);
        setSavedQuoteId(null);
        setSavedQuoteItemId(null);
        setLegacyItemIndex(null);
      } else {
        setEditMode(editModeParam);
        setSavedQuoteId(searchParams.get('savedQuoteId'));
        setDraftQuoteId(null);
        setSavedQuoteItemId(searchParams.get('itemId'));
        setLegacyItemIndex(searchParams.get('itemIndex') ? parseInt(searchParams.get('itemIndex')!) : null);
      }

      if (editModeParam === 'draft' && (
        searchParams.get('quoteStyle') === 'fabrication' ||
        searchParams.get('processing') === 'manual'
      )) {
        const draftQuoteIdParam = searchParams.get('draftQuoteId')!;
        const manualProductItemParam = searchParams.get('manualProductItem');
        let manualProductItemRecord: Record<string, unknown> = {};

        if (manualProductItemParam) {
          try {
            const parsedManualItem = JSON.parse(manualProductItemParam);
            if (parsedManualItem && typeof parsedManualItem === 'object' && !Array.isArray(parsedManualItem)) {
              manualProductItemRecord = parsedManualItem;
            }
          } catch (error) {
            console.warn('Failed to restore manual product draft:', error);
          }
        }

        const manualMaterial = MATERIALS.find(material => material.id === 'manual-product') || {
          id: 'manual-product',
          name: '제품 제작',
        };
        const fallbackUnitPrice = Number(searchParams.get('totalPrice')) || 0;

        const restoredManualItem: ManualProductItem = {
          id: typeof manualProductItemRecord.id === 'string' ? manualProductItemRecord.id : draftQuoteIdParam,
          itemNumber: typeof manualProductItemRecord.itemNumber === 'string' ? manualProductItemRecord.itemNumber : '',
          name: typeof manualProductItemRecord.name === 'string' ? manualProductItemRecord.name : '제품 제작',
          quantity: Number(manualProductItemRecord.quantity) || Number(searchParams.get('quantity')) || 1,
          unitPrice: Number(manualProductItemRecord.unitPrice) || fallbackUnitPrice,
          sizeWidth: typeof manualProductItemRecord.sizeWidth === 'string' ? manualProductItemRecord.sizeWidth : '',
          sizeHeight: typeof manualProductItemRecord.sizeHeight === 'string' ? manualProductItemRecord.sizeHeight : '',
          sizeDepth: typeof manualProductItemRecord.sizeDepth === 'string' ? manualProductItemRecord.sizeDepth : '',
          material: typeof manualProductItemRecord.material === 'string' ? manualProductItemRecord.material : '',
          thickness: typeof manualProductItemRecord.thickness === 'string' ? manualProductItemRecord.thickness : '',
          color: typeof manualProductItemRecord.color === 'string' ? manualProductItemRecord.color : '',
          colorHex: typeof manualProductItemRecord.colorHex === 'string' ? manualProductItemRecord.colorHex : '',
          surfaceType: typeof manualProductItemRecord.surfaceType === 'string' ? manualProductItemRecord.surfaceType : '',
          productType: typeof manualProductItemRecord.productType === 'string' ? manualProductItemRecord.productType : '',
          bondingMethod: typeof manualProductItemRecord.bondingMethod === 'string' ? manualProductItemRecord.bondingMethod : '',
          notes: typeof manualProductItemRecord.notes === 'string' ? manualProductItemRecord.notes : '',
          calculationBreakdown: Array.isArray(manualProductItemRecord.calculationBreakdown)
            ? manualProductItemRecord.calculationBreakdown as { label: string; price: number }[]
            : undefined,
          pricingMeta: manualProductItemRecord.pricingMeta && typeof manualProductItemRecord.pricingMeta === 'object'
            ? manualProductItemRecord.pricingMeta as Record<string, unknown>
            : undefined,
        };

        setSelectedMaterial(manualMaterial);
        setManualProductItems([restoredManualItem]);
        setCalculatorType('quote');
        setCurrentStep(100);
        restoredSearchKeyRef.current = restoreKey;
        return;
      }

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

          sizeEntries.forEach(e => {
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

      restoredSearchKeyRef.current = restoreKey;
    }
  }, [searchKey, searchParams, quotes, navigate]);

  useEffect(() => {
    const loadActivePricingVersion = async () => {
      try {
        const { data, error } = await supabase
          .from('panel_pricing_versions')
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
  
  // URL의 type 파라미터와 내부 계산기 모드를 동기화한다.
  // 단, 편집 모드와 수율 추천 적용 중에는 기존 복원/전환 흐름을 유지한다.
  useEffect(() => {
    const editModeParam = searchParams.get('editMode');
    if (editModeParam === 'saved' || editModeParam === 'draft' || yieldAppliedSelection) return;

    setCalculatorType(resolvedInitialType);
    setCurrentStep(resolvedInitialType === 'yield' ? -1 : 1);
  }, [resolvedInitialType, searchKey, searchParams, yieldAppliedSelection]);
  
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
  
  const polishedEdgeLengthM = Math.max(0, polishedEdgeLengthMm || 0) / 1000;

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
    bevelLengthM: 0,
    polishedEdgeLengthM,
    laserHoles: 0,
    edgeFinishing,
    bulgwang,
    tapung,
    mugwangPainting
  });

  // 이전 단계로 돌아가기 버튼
  const resetFromStep = (step: number) => {
    if (step <= 8) {
      setIsProcessingSelectionComplete(false);
    }

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
      setCurrentStep(1);
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
      setBevelLengthM(0);
      setLaserHoles(0);
      setSelectedProcessing('');
      setSelectedProcessingName('');
      setSelectedAdhesion('');
      setCurrentStep(8);
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
        id: createQuoteItemId(),
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
        productType: '',
        bondingMethod: '',
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
    colorTypeLabel?: string;
    colorAttributes?: unknown;
  }) => {
    console.log('Color selected:', colorId, colorInfo);
    if (colorInfo) {
      setSelectedColor(colorInfo.acCode);
      setSelectedColorHex(colorInfo.hexCode);
      setCustomColorName(colorInfo.customColorName || '');
      setCustomOpacity(colorInfo.customOpacity || '');
      setSelectedColorType(colorInfo.colorTypeLabel || (colorInfo.isBrightPigment ? '화이트 안료 추가' : ''));
    } else {
      setSelectedColor(colorId);
    }

    if (yieldAppliedSelection) {
      setCurrentStep(3);
      return;
    }
    
    // 편집 모드에서는 기존 두께/사이즈/면수/조색비/가공 데이터를 유지하고 두께 선택 단계로 이동
    if ((editMode === 'saved' || editMode === 'draft') && selectedThickness && selectedSize) {
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
    if ((editMode === 'saved' || editMode === 'draft') && selectedSize) {
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
    if (editMode !== 'saved' && editMode !== 'draft') {
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
    if (editMode !== 'saved' && editMode !== 'draft') {
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
    setIsProcessingSelectionComplete(false);

    // 가공 옵션 단계로 진입하면 기본 원판 구매 기준을 설정하여 버튼 비활성/0원 계산을 방지
    if (!selectedProcessing) {
      setSelectedProcessing('raw-only');
      setSelectedProcessingName('원판 단독 구매');
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
    setIsProcessingSelectionComplete(false);
    
    // 가공 옵션 단계로 진입하면 기본 원판 구매 기준을 설정하여 버튼 비활성/0원 계산을 방지
    if (!selectedProcessing) {
      setSelectedProcessing('raw-only');
      setSelectedProcessingName('원판 단독 구매');
    }
    
    setCurrentStep(9); // 가공 선택 단계로 이동 (수량 포함)
  };

  const getActivePricingVersionDisplayName = (capturedAt?: string) => formatPricingVersionDisplayName({
    versionName: activePricingVersion?.version_name,
    supplierName: activePricingVersion?.supplier_name,
    effectiveFrom: activePricingVersion?.effective_from,
    capturedAt,
  });

  const createCalculationSnapshot = (
    breakdown: { label: string; price: number }[],
    totalPrice: number,
    extraOptions: Record<string, unknown> = {},
    calculationMeta?: {
      status?: string;
      warnings?: string[];
      blockedReasons?: string[];
      lineItems?: unknown[];
      snapshotVersion?: string;
      formulaDocVersion?: number;
    }
  ) => {
    const capturedAt = new Date().toISOString();
    const pricingVersionDisplayName = getActivePricingVersionDisplayName(capturedAt);

    return {
      schemaVersion: 2,
      capturedAt,
      snapshotVersion: calculationMeta?.snapshotVersion || 'pricing-engine-v2-core-260520',
      formulaDocVersion: calculationMeta?.formulaDocVersion || 260520,
      pricingVersion: activePricingVersion ? {
        id: activePricingVersion.id,
        versionName: pricingVersionDisplayName,
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
        yieldRecommendation: yieldAppliedSelection?.yieldRecommendation || null,
        colorType: selectedColorType,
        selectedColor,
        selectedColorHex,
        customColorName,
        customOpacity,
        processing: selectedProcessing,
        processingName: selectedProcessingName || PROCESSING_OPTIONS.find(p => p.id === selectedProcessing)?.name || '',
        additionalOptions: selectedAdditionalOptions,
        quantityContext: {
          panelQty: selectedSizes.reduce((sum, item) => sum + Math.max(0, item.quantity || 0), 0),
          optionQty: selectedAdditionalOptions,
          lineQty: 1,
          productQty: qty,
        },
        qty,
        isComplex,
        bevelLengthM: 0,
        polishedEdgeLengthM,
        polishedEdgeLengthMm,
        laserHoles: 0,
        edgeFinishing,
        bulgwang,
        tapung,
        mugwangPainting,
        ...extraOptions,
      },
      calculationStatus: calculationMeta?.status || 'calculable',
      calculationWarnings: calculationMeta?.warnings || [],
      calculationBlockedReasons: calculationMeta?.blockedReasons || [],
      calculationLineItems: calculationMeta?.lineItems || [],
      calculationEngineVersion: calculationMeta?.snapshotVersion || 'pricing-engine-v2-core-260520',
      quantityContext: {
        panelQty: selectedSizes.reduce((sum, item) => sum + Math.max(0, item.quantity || 0), 0),
        optionQty: selectedAdditionalOptions,
        lineQty: 1,
        productQty: qty,
      },
      breakdown: breakdown.map(item => ({ ...item })),
      totalPrice,
      note: '저장 당시 단가와 계산 근거입니다. 이후 단가표 변경은 이 견적 금액에 자동 반영되지 않습니다.',
    };
  };

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

    if (!isProcessingSelectionComplete) {
      alert('가공 카테고리의 세부 옵션을 선택해주세요. 가공이 없는 경우 원판 구매 옵션을 선택해주세요.');
      return;
    }

    if (priceInfo.status === 'blocked' || priceInfo.totalPrice <= 0) {
      const reason = priceInfo.blockedReasons?.[0] || '계산 가능한 견적 금액이 없습니다.';
      alert(`견적을 추가할 수 없습니다.\n${reason}`);
      return;
    }

    const processingName = selectedProcessingName || PROCESSING_OPTIONS.find(p => p.id === selectedProcessing)?.name || '';
    const itemTitleParam = searchParams.get('itemTitle')?.trim();
    
    // 다중 선택된 사이즈를 하나의 견적으로 처리 (총 가격은 priceInfo.totalPrice)
    const quoteData: QuoteDraft = {
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
      pricingVersionName: getActivePricingVersionDisplayName(),
      quoteStyle: 'panel' as const,
      ...(itemTitleParam ? { itemTitle: itemTitleParam } : {}),
      calculationSnapshot: createCalculationSnapshot(priceInfo.breakdown, priceInfo.totalPrice, {}, priceInfo)
    };

    // 발행 전 임시 견적 수정 모드: 새 항목을 추가하지 않고 기존 항목만 교체
    if (editMode === 'draft' && draftQuoteId) {
      const draftQuoteExists = quotes.some(quote => quote.id === draftQuoteId);

      if (!draftQuoteExists) {
        toast.error('수정할 임시 견적 항목을 찾을 수 없습니다.');
        navigate(quotes.length > 0 ? '/internal-quote' : '/calculator?type=quote');
        return;
      }

      updateQuote(draftQuoteId, quoteData);
      toast.success('견적 항목이 수정되었습니다.');
      clearCalculatorRecoveryDraft();
      setEditMode(null);
      setDraftQuoteId(null);
      navigate('/internal-quote');
      return;
    }

    // 편집 모드일 때: 저장된 견적서의 해당 항목을 업데이트
    if (editMode === 'saved' && savedQuoteId && (savedQuoteItemId || legacyItemIndex !== null)) {
      try {
        // 기존 견적서 데이터 가져오기
        const { data: existingQuote, error: fetchError } = await supabase
          .from('saved_quotes')
          .select('items, subtotal, tax, total, quote_number, project_name, recipient_company, recipient_name, recipient_phone, recipient_email, recipient_address, recipient_memo, quote_date_display, valid_until, delivery_period, payment_condition, desired_delivery_date, issuer_name, issuer_email, issuer_phone, attachments, user_id')
          .eq('id', savedQuoteId)
          .single();

        if (fetchError) throw fetchError;

        // items 배열 업데이트
        const items = toSavedQuoteItems(existingQuote.items);
        const targetIndex = savedQuoteItemId
          ? items.findIndex(item => item.id === savedQuoteItemId)
          : legacyItemIndex ?? -1;

        if (targetIndex < 0 || targetIndex >= items.length) {
          toast.error('수정할 저장 견적 항목을 찾을 수 없습니다.');
          return;
        }

        const existingItem = items[targetIndex];
        items[targetIndex] = {
          ...existingItem,
          ...quoteData,
          id: existingItem.id || savedQuoteItemId || createQuoteItemId(),
          createdAt: existingItem.createdAt || new Date().toISOString(),
        };

        // 총액 재계산
        const newSubtotal = calculateSavedQuoteSubtotal(items);
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
              schemaVersion: 2,
              capturedAt: new Date().toISOString(),
              snapshotVersion: 'issued-quote-snapshot-v2',
              formulaDocVersion: 260520,
              pricingVersionId: activePricingVersion?.id || null,
              pricingVersionName: getActivePricingVersionDisplayName(),
              items: items.map(item => ({
                id: item.id,
                totalPrice: item.totalPrice,
                quantity: item.quantity || 1,
                calculationSnapshot: item.calculationSnapshot || null,
              })),
            },
          } as any)
          .eq('id', savedQuoteId);

        if (updateError) throw updateError;

        alert('견적 항목이 수정되었습니다!');
        clearCalculatorRecoveryDraft();
        
        // 편집 모드 초기화 및 저장된 견적서 상세 페이지로 이동
        setEditMode(null);
        setSavedQuoteId(null);
        setDraftQuoteId(null);
        setSavedQuoteItemId(null);
        setLegacyItemIndex(null);
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

        const items = toSavedQuoteItems(existingQuote.items);
        items.push({
          ...quoteData,
          id: createQuoteItemId(),
          createdAt: new Date().toISOString()
        });

        const newSubtotal = calculateSavedQuoteSubtotal(items);
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
              schemaVersion: 2,
              capturedAt: new Date().toISOString(),
              snapshotVersion: 'issued-quote-snapshot-v2',
              formulaDocVersion: 260520,
              pricingVersionId: activePricingVersion?.id || null,
              pricingVersionName: getActivePricingVersionDisplayName(),
              items: items.map(item => ({
                id: item.id,
                totalPrice: item.totalPrice,
                quantity: item.quantity || 1,
                calculationSnapshot: item.calculationSnapshot || null,
              })),
            },
          } as any)
          .eq('id', savedQuoteId);

        if (updateError) throw updateError;

        alert('새 견적 항목이 추가되었습니다!');
        clearCalculatorRecoveryDraft();
        setEditMode(null);
        setSavedQuoteId(null);
        setDraftQuoteId(null);
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
    clearCalculatorRecoveryDraft();

    // Reset form for new quote - 모든 상태 초기화
    setCurrentStep(1);
    setCalculatorType('quote');
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
    const itemTitleParam = searchParams.get('itemTitle')?.trim();
    const quoteDataList: QuoteDraft[] = validItems.map(item => {
      const sizeParts = [item.sizeWidth, item.sizeHeight, item.sizeDepth].filter(p => p.trim());
      const sizeStr = sizeParts.length > 0 ? sizeParts.join(' × ') : '-';
      const itemTotal = item.unitPrice * item.quantity;
      const fabricationTags = [item.productType, item.bondingMethod].filter(Boolean).join(' / ');
      
      const breakdownItems: { label: string; price: number }[] = [
        {
          label: `${fabricationTags ? `${fabricationTags} - ` : ''}제품 제작 수동 단가 (${item.quantity}개 × ₩${item.unitPrice.toLocaleString()})`,
          price: itemTotal,
        }
      ];
      
      if (item.notes.trim()) {
        breakdownItems.push({ label: `메모: ${item.notes}`, price: 0 });
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
        surface: fabricationTags || item.surfaceType || '-',
        colorMixingCost: 0,
        processing: 'manual',
        processingName: `${item.itemNumber ? `[${item.itemNumber}] ` : ''}${item.name}`,
        totalPrice: itemTotal,
        quantity: 1,
        breakdown: breakdownItems,
        pricingVersionId: activePricingVersion?.id || null,
        pricingVersionName: getActivePricingVersionDisplayName(),
        quoteStyle: 'fabrication' as const,
        ...(itemTitleParam ? { itemTitle: itemTitleParam } : {}),
        calculationSnapshot: createCalculationSnapshot(
          breakdownItems,
          itemTotal,
          {
            manualProductItem: { ...item },
            pricingMeta: {
              ...(item.pricingMeta || {}),
              pricingType: 'manual-fabrication-unit-price',
              productType: item.productType || null,
              bondingMethod: item.bondingMethod || null,
            },
          }
        )
      };
    });

    // 발행 전 제품 제작 임시 견적 수정 모드
    if (editMode === 'draft' && draftQuoteId) {
      const draftQuoteExists = quotes.some(quote => quote.id === draftQuoteId);

      if (!draftQuoteExists) {
        toast.error('수정할 임시 견적 항목을 찾을 수 없습니다.');
        navigate(quotes.length > 0 ? '/internal-quote' : '/calculator?type=quote');
        return;
      }

      if (quoteDataList.length !== 1) {
        toast.error('제품 제작 견적 수정은 한 항목씩 진행해주세요.');
        return;
      }

      updateQuote(draftQuoteId, quoteDataList[0]);
      toast.success('견적 항목이 수정되었습니다.');
      clearCalculatorRecoveryDraft();
      setEditMode(null);
      setDraftQuoteId(null);
      setManualProductItems([]);
      setSelectedMaterial(null);
      setCurrentStep(1);
      setCalculatorType('quote');
      navigate('/internal-quote');
      return;
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

        const items = toSavedQuoteItems(existingQuote.items);
        quoteDataList.forEach(qd => {
          items.push({
            ...qd,
            id: createQuoteItemId(),
            createdAt: new Date().toISOString()
          });
        });

        const newSubtotal = calculateSavedQuoteSubtotal(items);
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
              schemaVersion: 2,
              capturedAt: new Date().toISOString(),
              snapshotVersion: 'issued-quote-snapshot-v2',
              formulaDocVersion: 260520,
              pricingVersionId: activePricingVersion?.id || null,
              pricingVersionName: getActivePricingVersionDisplayName(),
              items: items.map(item => ({
                id: item.id,
                totalPrice: item.totalPrice,
                quantity: item.quantity || 1,
                calculationSnapshot: item.calculationSnapshot || null,
              })),
            },
          } as any)
          .eq('id', savedQuoteId);

        if (updateError) throw updateError;

        alert(`${validItems.length}개의 제품 제작 항목이 견적서에 추가되었습니다!`);
        clearCalculatorRecoveryDraft();
        setEditMode(null);
        setSavedQuoteId(null);
        setDraftQuoteId(null);
        setManualProductItems([]);
        setSelectedMaterial(null);
        setCurrentStep(1);
        setCalculatorType('quote');
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
    clearCalculatorRecoveryDraft();

    // 리셋
    setManualProductItems([]);
    setSelectedMaterial(null);
    setCurrentStep(1);
    setCalculatorType('quote');
    
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
    yieldRecommendation?: YieldRecommendationSnapshot;
  }) => {
    // 재질 매핑 (아크릴 판 기준)
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
      yieldRecommendation: panelData.yieldRecommendation,
    });

    // 견적계산기 모드로 전환하고 컬러 선택 단계로 이동
    setCalculatorType('quote');
    navigate('/calculator?type=quote', { replace: true });
    setCurrentStep(3);
  };
  const handleBackToCalculatorSelection = () => {
    setCurrentStep(1);
    setCalculatorType('quote');
    navigate('/calculator?type=quote', { replace: true });
  };
  // 필름 아크릴의 경우 maxSteps를 10으로 설정 (필름 선택 단계 추가)
  const maxSteps = selectedQuality?.id === 'film-acrylic' ? 10 : 9;
  const isRawOnlyProcessing = selectedProcessing === 'raw-only';
  const isQuoteProcessingReady = isProcessingSelectionComplete || isRawOnlyProcessing;
  const quoteSubmitDisabledReason = !isQuoteProcessingReady
    ? '가공 카테고리의 세부 옵션을 선택해주세요. 가공이 없는 경우 원판 구매 옵션을 선택해주세요.'
    : priceInfo.status === 'blocked'
      ? priceInfo.blockedReasons?.[0] || '생산 불가 조합 또는 단가 미등록 상태입니다.'
      : priceInfo.totalPrice <= 0
        ? '계산 가능한 견적 금액이 없습니다. 원판 사이즈, 면수, 단가표를 확인해주세요.'
        : null;
  return <div className="w-full">
      <Card className="mx-auto w-full max-w-5xl animate-fade-up overflow-hidden rounded-lg border border-border bg-card shadow-none">
        <CardHeader className="border-b border-border bg-card px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground/75">
                <Calculator className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold tracking-[0.14em] text-foreground sm:text-base">ACBANK</span>
                  <span className="text-sm font-medium text-muted-foreground">Quotation System</span>
                </div>
                <p className="mt-1 text-xs font-normal text-muted-foreground">아크뱅크 내부 계산 시스템</p>
              </div>
            </CardTitle>
            {quotes.length > 0 && <Button onClick={handleViewQuotesSummary} variant="outline" size="sm" className="shrink-0 rounded-full border-border bg-background shadow-none hover:bg-muted">
              <ShoppingCart className="h-4 w-4" />
              담은 견적 보기 ({quotes.length})
            </Button>}
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-7 space-y-7">
          {pendingRecoveryDraft && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold">이전 계산기 작성 상태가 있습니다.</div>
                  <div className="mt-1 text-xs text-amber-800">
                    저장 시각 {new Date(pendingRecoveryDraft.savedAt).toLocaleString('ko-KR')} 기준의 선택값을 복구할 수 있습니다.
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-amber-900 text-white hover:bg-amber-800"
                    onClick={() => applyCalculatorRecoveryDraft(pendingRecoveryDraft)}
                  >
                    복구
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-amber-300 bg-white"
                    onClick={clearCalculatorRecoveryDraft}
                  >
                    삭제
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 수율 계산기 */}
          {currentStep === -1 && <YieldCalculator onBack={handleBackToCalculatorSelection} onPanelSelect={panelData => handlePanelSelectFromYield(panelData)} />}
          
          {/* 견적 계산기 단계들 */}
          {currentStep >= 1 && <>
              <StepIndicator currentStep={currentStep} maxSteps={maxSteps} />
          
          {/* 선택된 옵션 요약 및 가격 계산 결과 */}
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
              name: '공통 단가'
            }]}
            priceInfo={priceInfo}
          />}
          
          {/* Step 1: 소재 선택 */}
          {currentStep === 1 && <MaterialSelection materials={MATERIALS} selectedMaterial={selectedMaterial} selectedFactory="jangwon" factories={[{
            id: 'jangwon',
            name: '공통 단가'
          }]} onMaterialSelect={handleMaterialSelect} />}

          {/* Step 100: 제품 제작 수동 입력 */}
          {currentStep === 100 && selectedMaterial?.id === 'manual-product' && (
            <ManualProductEntry
              items={manualProductItems}
              onItemsChange={setManualProductItems}
              onNext={handleManualProductNext}
            />
          )}

          {yieldAppliedSelection && currentStep >= 3 && (
            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="font-semibold text-foreground">수율 계산 추천을 견적에 적용 중입니다.</div>
              <div className="mt-1 text-muted-foreground">
                {yieldAppliedSelection.thickness} · {yieldAppliedSelection.sizes.map(s => `${s.size} ${s.quantity}장`).join(', ')}
                {yieldAppliedSelection.yieldRecommendation && (
                  <span>
                    {' '}· 효율 {yieldAppliedSelection.yieldRecommendation.efficiency.toFixed(1)}%
                    {yieldAppliedSelection.yieldRecommendation.largestReusableRect
                      ? ` · 재활용 잔재 최대 ${yieldAppliedSelection.yieldRecommendation.largestReusableRect.width.toFixed(0)}×${yieldAppliedSelection.yieldRecommendation.largestReusableRect.height.toFixed(0)}mm`
                      : ''}
                  </span>
                )}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                색상, 면수, 조색비, 가공 옵션만 이어서 선택하면 견적 항목에 수율 계산 근거가 함께 저장됩니다.
              </div>
            </div>
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
            <>
              <ProcessingOptions
                selectedProcessing={selectedProcessing}
                selectedAdhesion={selectedAdhesion}
                onProcessingSelect={handleProcessingSelect}
                onAdhesionSelect={handleAdhesionSelect}
                onSelectionCompleteChange={setIsProcessingSelectionComplete}
                isGlossyStandard={selectedQuality?.id === 'glossy-standard'}
                selectedQualityId={selectedQuality?.id}
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
                polishedEdgeLengthMm={polishedEdgeLengthMm}
                onPolishedEdgeLengthMmChange={setPolishedEdgeLengthMm}
                selectedAdditionalOptions={selectedAdditionalOptions}
                onAdditionalOptionsChange={setSelectedAdditionalOptions}
              />
              <AdvancedProcessingOptions
                qty={qty}
                onQtyChange={setQty}
                isComplex={isComplex}
                onComplexChange={setIsComplex}
              />
            </>
          )}

          {/* 견적 추가/수정 버튼 */}
          {((currentStep === 8 && selectedQuality?.id !== 'film-acrylic' && selectedSizes.length > 0) ||
            (currentStep === 9 && selectedQuality?.id === 'film-acrylic' && selectedSizes.length > 0)) && (
            <>
              <Separator className="my-8" />
              <div className="flex justify-center gap-4">
                <Button
                  onClick={handleAddQuote}
                  size="lg"
                  disabled={Boolean(quoteSubmitDisabledReason)}
                  className={`animate-fade-up px-8 ${(editMode === 'saved' || editMode === 'draft' || editMode === 'addToSaved') ? 'bg-slate-950 hover:bg-slate-800' : 'bg-slate-950 hover:bg-slate-800'}`}
                >
                  <Plus className="w-5 h-5" />
                  {(editMode === 'saved' || editMode === 'draft') ? '견적 수정' : editMode === 'addToSaved' ? '견적서에 항목 추가' : '견적 추가'}
                </Button>
                {(((editMode === 'saved' || editMode === 'addToSaved') && savedQuoteId) || (editMode === 'draft' && draftQuoteId)) && (
                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={() => {
                      const currentSavedQuoteId = savedQuoteId;
                      const isDraftEdit = editMode === 'draft';
                      clearCalculatorRecoveryDraft();
                      setEditMode(null);
                      setSavedQuoteId(null);
                      setDraftQuoteId(null);
                      setSavedQuoteItemId(null);
                      setLegacyItemIndex(null);
                      navigate(isDraftEdit ? '/internal-quote' : `/saved-quotes/${currentSavedQuoteId}`);
                    }}
                    className="px-8"
                  >
                    취소
                  </Button>
                )}
              </div>
              {quoteSubmitDisabledReason && (
                <div className="mx-auto mt-3 max-w-xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-800">
                  {quoteSubmitDisabledReason}
                </div>
              )}
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
                  const currentSavedQuoteId = savedQuoteId;
                  const isDraftEdit = editMode === 'draft';
                  const shouldReturnToSavedQuote = Boolean(currentSavedQuoteId && editMode === 'addToSaved');
                  clearCalculatorRecoveryDraft();
                  setManualProductItems([]);
                  setSelectedMaterial(null);
                  setEditMode(null);
                  setSavedQuoteId(null);
                  setDraftQuoteId(null);
                  setSavedQuoteItemId(null);
                  setLegacyItemIndex(null);

                  if (isDraftEdit) {
                    navigate('/internal-quote');
                    return;
                  }

                  if (shouldReturnToSavedQuote) {
                    navigate(`/saved-quotes/${currentSavedQuoteId}`);
                    return;
                  }

                  setCurrentStep(1);
                }} className="px-6">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {(editMode === 'draft' || editMode === 'addToSaved') ? '취소' : '소재 선택으로'}
                </Button>
              </div>
            </>}
            </>}
        </CardContent>
      </Card>
    </div>;
};
export default PanelCalculator;
