
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Material, Quality } from "@/types/calculator";
import {
  calculatePrice,
  classifyCalculationLineItem,
  DEFAULT_ADHESION_CONFIG,
  DEFAULT_FORMULA_CONSTANTS,
  CalculatePriceResult,
  ProcessingOptionData,
  ProcessingProfile,
  AdhesionProfile,
} from "@/utils/priceCalculations";

type PanelQuality = Database['public']['Enums']['panel_quality'];

interface SizeQuantitySelection {
  size: string;
  quantity: number;
  surface?: string;
  colorMixingCost?: number;
  surfaceAdditionalCost?: number; // 면수 추가금액
}

interface UsePriceCalculationProps {
  selectedFactory: string;
  selectedMaterial: Material | null;
  selectedQuality: Quality | null;
  selectedThickness: string;
  selectedSize: string;
  selectedSizes?: SizeQuantitySelection[]; // 다중 선택 지원
  selectedColorType: string;
  selectedSurface: string;
  colorMixingCost: number;
  selectedProcessing: string;
  selectedAdhesion: string;
  selectedAdditionalOptions?: Record<string, number>; // 추가 옵션 수량
  // V2 고급 옵션
  qty?: number;
  isComplex?: boolean;
  bevelLengthM?: number;
  polishedEdgeLengthM?: number;
  laserHoles?: number;
  corners90?: number;
  useDetailedBond?: boolean;
  joinLengthM?: number;
  trayHeightMm?: number;
  bondProductType?: 'flat' | 'tray' | 'box';
  edgeFinishing?: boolean;
  bulgwang?: boolean;
  tapung?: boolean;
  mugwangPainting?: boolean;
}

type PriceInfo = Pick<CalculatePriceResult, 'totalPrice' | 'breakdown' | 'status' | 'lineItems' | 'warnings' | 'blockedReasons' | 'snapshotVersion' | 'formulaDocVersion'>;

const EMPTY_PRICE_INFO: PriceInfo = {
  totalPrice: 0,
  breakdown: [],
  status: 'calculable',
  lineItems: [],
  warnings: [],
  blockedReasons: [],
  snapshotVersion: 'pricing-engine-v2-core-260520',
  formulaDocVersion: 260520,
};

export const usePriceCalculation = ({
  selectedFactory,
  selectedMaterial,
  selectedQuality,
  selectedThickness,
  selectedSize,
  selectedSizes,
  selectedColorType,
  selectedSurface,
  colorMixingCost,
  selectedProcessing,
  selectedAdhesion,
  selectedAdditionalOptions = {},
  // V2 고급 옵션
  qty = 1,
  isComplex = false,
  bevelLengthM = 0,
  polishedEdgeLengthM = 0,
  laserHoles = 0,
  corners90 = 0,
  useDetailedBond = false,
  joinLengthM = 0,
  trayHeightMm,
  bondProductType = 'flat',
  edgeFinishing = false,
  bulgwang = false,
  tapung = false,
  mugwangPainting = false
}: UsePriceCalculationProps) => {
  const [priceInfo, setPriceInfo] = useState<PriceInfo>(EMPTY_PRICE_INFO);
  const panelMasterLookupQualityId = selectedQuality?.id === 'bright-color'
    ? 'glossy-color'
    : selectedQuality?.id;

  // Fetch panel master for the selected quality
  const { data: panelMaster } = useQuery({
    queryKey: ['panel-master-for-calc', panelMasterLookupQualityId],
    queryFn: async () => {
      if (!panelMasterLookupQualityId) return null;
      
      const { data, error } = await supabase
        .from('panel_masters')
        .select('*')
        .eq('quality', panelMasterLookupQualityId as PanelQuality)
        .maybeSingle();

      if (error) {
        console.error('Error fetching panel master:', error);
        return null;
      }

      return data;
    },
  });

  const { data: clearPanelMaster } = useQuery({
    queryKey: ['panel-master-for-calc', 'glossy-color'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('panel_masters')
        .select('*')
        .eq('quality', 'glossy-color' as PanelQuality)
        .maybeSingle();

      if (error) {
        console.error('Error fetching clear panel master:', error);
        return null;
      }

      return data;
    },
  });

  // Fetch active processing options (모든 필드 가져오기)
  const { data: processingOptions } = useQuery({
    queryKey: ['processing-options', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processing_options')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching processing options:', error);
        return [];
      }

      console.log('Loaded processing options:', data);
      return data as ProcessingOptionData[];
    },
  });

  // Fetch advanced processing settings (raw_only_multiplier 등)
  const { data: advancedSettings } = useQuery({
    queryKey: ['advanced-processing-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('advanced_processing_settings')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching advanced processing settings:', error);
        return [];
      }

      return data;
    },
  });

  // Fetch active panel sizes
  const { data: activePanelSizes } = useQuery({
    queryKey: ['active-panel-sizes', panelMaster?.id, selectedThickness],
    queryFn: async () => {
      if (!panelMaster?.id || !selectedThickness) return [];
      
      const { data, error } = await supabase
        .from('panel_sizes')
        .select('*')
        .eq('panel_master_id', panelMaster.id)
        .eq('thickness', selectedThickness)
        .eq('is_active', true);
      
      if (error) throw error;
      return data;
    },
    enabled: !!panelMaster?.id && !!selectedThickness
  });

  const { data: clearPanelSizes } = useQuery({
    queryKey: ['active-panel-sizes-clear-base', clearPanelMaster?.id, selectedThickness],
    queryFn: async () => {
      if (!clearPanelMaster?.id || !selectedThickness) return [];
      
      const { data, error } = await supabase
        .from('panel_sizes')
        .select('*')
        .eq('panel_master_id', clearPanelMaster.id)
        .eq('thickness', selectedThickness)
        .eq('is_active', true);
      
      if (error) throw error;
      return data;
    },
    enabled: !!clearPanelMaster?.id && !!selectedThickness
  });

  const { data: optionSurcharges } = useQuery({
    queryKey: ['panel-option-surcharges-calc', selectedQuality?.id],
    queryFn: async () => {
      if (!selectedQuality?.id) return [];

      const { data, error } = await supabase
        .from('panel_option_surcharges')
        .select('*')
        .in('quality_id', ['global', selectedQuality.id])
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedQuality?.id
  });

  // Fetch color mixing costs
  const { data: colorMixingCosts } = useQuery({
    queryKey: ['color-mixing-costs-calc', panelMaster?.id],
    queryFn: async () => {
      if (!panelMaster?.id) return [];
      
      const { data, error } = await supabase
        .from('color_mixing_costs')
        .select('*')
        .eq('panel_master_id', panelMaster.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!panelMaster?.id
  });

  const formatCatalogPanelSize = (
    sizeName: string,
    actualWidth?: number | null,
    actualHeight?: number | null,
  ) => {
    if (actualWidth && actualHeight) {
      return `${sizeName} (${actualWidth}*${actualHeight})`;
    }

    return sizeName;
  };

  const toPanelSizeData = (sizes?: typeof activePanelSizes) =>
    sizes?.map(ps => ({
      id: ps.id,
      size_name: ps.size_name,
      thickness: ps.thickness,
      price: ps.price || undefined,
      is_active: Boolean(ps.is_active),
      actual_width: ps.actual_width,
      actual_height: ps.actual_height,
      pricing_version_id: ps.pricing_version_id,
    })) || [];

  // 특정 두께와 사이즈 조합에 활성 DB 단가가 있는지 확인하는 함수
  const hasPriceData = (qualityId: string, thickness: string, size: string): boolean => {
    if (selectedFactory !== 'jangwon' || !activePanelSizes) return false;
    const sizeKey = size.split(' ')[0].trim();
    return activePanelSizes.some(panelSize =>
      panelSize.size_name === sizeKey &&
      panelSize.thickness === thickness &&
      panelSize.is_active &&
      Boolean(panelSize.price && panelSize.price > 0)
    );
  };

  // 사용 가능한 사이즈 필터링 함수
  const getAvailableSizes = (): string[] => {
    if (!selectedQuality || !selectedThickness) return [];

    if (!activePanelSizes || activePanelSizes.length === 0) return [];

    return activePanelSizes
      .filter(ps => ps.is_active && ps.price && ps.price > 0 && ps.actual_width && ps.actual_height)
      .sort((a, b) => {
        const areaA = (a.actual_width || 0) * (a.actual_height || 0);
        const areaB = (b.actual_width || 0) * (b.actual_height || 0);
        return areaA - areaB;
      })
      .map(ps => formatCatalogPanelSize(ps.size_name, ps.actual_width, ps.actual_height));
  };

  // 가격 계산 업데이트 (V2 증분 방식)
  useEffect(() => {
    console.log('Price calculation triggered with:', {
      factory: selectedFactory,
      material: selectedMaterial?.id,
      quality: selectedQuality?.id,
      thickness: selectedThickness,
      size: selectedSize,
      selectedSizes: selectedSizes,
      colorType: selectedColorType,
      surface: selectedSurface,
      colorMixingCost: colorMixingCost,
      processing: selectedProcessing,
      adhesion: selectedAdhesion
    });

    // 원판 단독 구매 할증률 가져오기
    const rawOnlySetting = advancedSettings?.find(s => s.setting_key === 'raw_only_multiplier')?.setting_value;
    const rawOnlyMultiplier = Number.isFinite(Number(rawOnlySetting)) ? Number(rawOnlySetting) : 1.8;
    const getAdvancedSettingValue = (key: string, fallback: number) => {
      const value = advancedSettings?.find(s => s.setting_key === key)?.setting_value;
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? numericValue : fallback;
    };
    const formulaConstants = {
      ...DEFAULT_FORMULA_CONSTANTS,
      rawOnlyMultiplier,
      simpleCutThinMultiplier: getAdvancedSettingValue('simple_cut_thin_multiplier', DEFAULT_FORMULA_CONSTANTS.simpleCutThinMultiplier),
      simpleCutThickMultiplier: getAdvancedSettingValue('simple_cut_thick_multiplier', DEFAULT_FORMULA_CONSTANTS.simpleCutThickMultiplier),
      fabricationBaseMultiplier: getAdvancedSettingValue('fabrication_base_multiplier', DEFAULT_FORMULA_CONSTANTS.fabricationBaseMultiplier),
      complexCutSetupFee: getAdvancedSettingValue('complex_cut_setup_fee', DEFAULT_FORMULA_CONSTANTS.complexCutSetupFee),
      laserThinFee: getAdvancedSettingValue('laser_thin_fee', DEFAULT_FORMULA_CONSTANTS.laserThinFee),
      laserThickFee: getAdvancedSettingValue('laser_thick_fee', DEFAULT_FORMULA_CONSTANTS.laserThickFee),
      laserFullThinSheetFee: getAdvancedSettingValue('laser_full_thin_sheet_fee', DEFAULT_FORMULA_CONSTANTS.laserFullThinSheetFee),
      cncGeneralFee: getAdvancedSettingValue('cnc_general_fee', DEFAULT_FORMULA_CONSTANTS.cncGeneralFee),
      cncHeavyFee: getAdvancedSettingValue('cnc_heavy_fee', DEFAULT_FORMULA_CONSTANTS.cncHeavyFee),
      cncFullFee: getAdvancedSettingValue('cnc_full_fee', DEFAULT_FORMULA_CONSTANTS.cncFullFee),
      complexShapeFee: getAdvancedSettingValue('complex_shape_fee', DEFAULT_FORMULA_CONSTANTS.complexShapeFee),
      mugipoBoxSetupFee: getAdvancedSettingValue('mugipo_box_setup_fee', DEFAULT_FORMULA_CONSTANTS.mugipoBoxSetupFee),
      mugipoBoxBondRatePerM: getAdvancedSettingValue('mugipo_box_bond_rate_per_m', DEFAULT_FORMULA_CONSTANTS.mugipoBoxBondRatePerM),
      mugipoBoxMinSalePrice5T250Cube: getAdvancedSettingValue('mugipo_box_min_sale_price_5t_250_cube', DEFAULT_FORMULA_CONSTANTS.mugipoBoxMinSalePrice5T250Cube),
      polishedEdgeRatePerM: getAdvancedSettingValue('polished_edge_rate_per_m', DEFAULT_FORMULA_CONSTANTS.polishedEdgeRatePerM),
      bulgwangFinishMultiplier: getAdvancedSettingValue('bulgwang_finish_multiplier', DEFAULT_FORMULA_CONSTANTS.bulgwangFinishMultiplier),
      mirrorDeposition3x6: getAdvancedSettingValue('mirror_deposition_3x6', DEFAULT_FORMULA_CONSTANTS.mirrorDeposition3x6),
      mirrorDeposition4x8: getAdvancedSettingValue('mirror_deposition_4x8', DEFAULT_FORMULA_CONSTANTS.mirrorDeposition4x8),
      mirrorHardCoating3x6: getAdvancedSettingValue('mirror_hard_coating_3x6', DEFAULT_FORMULA_CONSTANTS.mirrorHardCoating3x6),
      mirrorHardCoating4x8: getAdvancedSettingValue('mirror_hard_coating_4x8', DEFAULT_FORMULA_CONSTANTS.mirrorHardCoating4x8),
    };
    const bevelFeePerM = getAdvancedSettingValue('bevel_cost_per_m', 3000);
    const laserHoleFee = getAdvancedSettingValue('laser_hole_cost', 500);
    const adhesionConfig = {
      ...DEFAULT_ADHESION_CONFIG,
      setupFee: getAdvancedSettingValue('bond_setup_fee', DEFAULT_ADHESION_CONFIG.setupFee),
      bondRatePerM: getAdvancedSettingValue('bond_rate_per_m', DEFAULT_ADHESION_CONFIG.bondRatePerM),
      cornerFinishFee: getAdvancedSettingValue('corner_90_cost', DEFAULT_ADHESION_CONFIG.cornerFinishFee),
      kVolume: getAdvancedSettingValue('volume_discount_factor', DEFAULT_ADHESION_CONFIG.kVolume),
    };

    // 다중 선택된 사이즈가 있는 경우
    if (selectedMaterial && selectedQuality && selectedThickness && selectedSizes && selectedSizes.length > 0 && selectedFactory === 'jangwon') {
      // 1단계: 모든 원장 비용 계산 (원판금액 + 면수 + 조색비)
      let totalWonJang = 0;
      const wonJangBreakdown: PriceInfo['breakdown'] = [];
      const aggregateWarnings: string[] = [];
      const aggregateBlockedReasons: string[] = [];
      
      let globalIndex = 0; // 전체 원판 순서
      selectedSizes.forEach((sizeSelection) => {
        const surface = sizeSelection.surface || '단면';
        const sizeColorMixingCost = sizeSelection.colorMixingCost || 0;
        
        const sizeMatch = sizeSelection.size.match(/^([^(]+)/);
        const actualSize = sizeMatch ? sizeMatch[1].trim() : sizeSelection.size;

        // 각 수량만큼 반복하여 원장 계산
        for (let i = 0; i < sizeSelection.quantity; i++) {

          // 각 원장의 기본 비용만 계산 (가공 옵션 제외)
          const result = calculatePrice(
            selectedMaterial.id,
            selectedQuality.id,
            selectedThickness,
            actualSize,
            surface,
            selectedColorType || undefined,
            'raw-only', // 원장만 계산하기 위해 raw-only 제외
            sizeColorMixingCost,
            {
              processing: 'none',
              adhesion: 'none',
              qty: 1, // 각 원판은 1개씩 계산
              colorMixingCostsData: colorMixingCosts?.map(c => ({ thickness: c.thickness, cost: c.cost })),
              panelSizesData: toPanelSizeData(activePanelSizes),
              basePanelSizesData: toPanelSizeData(clearPanelSizes),
              optionSurchargesData: optionSurcharges as any,
              processingOptionsData: [],
              rawOnlyMultiplier: 1.0, // 원장 계산시에는 할증 제외
              formulaConstants: { ...formulaConstants, rawOnlyMultiplier: 1.0 },
              strictPanelCatalog: true,
            }
          );

          // 원장 비용만 추출 (원판 + 양단면 + 조색비)
          const wonJangPrice = result.lineItems
            .filter(item => item.source === 'panel' || item.source === 'surcharge' || item.source === 'mirror')
            .reduce((sum, item) => sum + item.amount, 0);

          totalWonJang += wonJangPrice;
          globalIndex++;
          aggregateWarnings.push(...result.warnings);
          aggregateBlockedReasons.push(...result.blockedReasons);
          
          wonJangBreakdown.push({
            label: `원장 #${globalIndex} (${actualSize}, ${surface})`,
            price: wonJangPrice,
            source: result.status === 'blocked' ? 'validation' : 'panel',
            code: `panel-${globalIndex}`,
            reason: result.blockedReasons[0],
          });
        }
      });

      // 2단계: 가공 옵션 비용 계산 (총 원장 기준)
      let totalPrice = totalWonJang;
      const allBreakdown: PriceInfo['breakdown'] = [...wonJangBreakdown];

      // 가공/접착 프로필 결정
      let processing: ProcessingProfile = 'none';
      let adhesion: AdhesionProfile = 'none';
      let edgeRequested = false;
      
      if (selectedProcessing === 'raw-only') {
        processing = 'none';
      } else if (selectedProcessing === 'auto') {
        processing = 'auto';
      } else if (selectedProcessing === 'simple-cutting') {
        processing = 'simple-cutting';
      } else if (selectedProcessing === 'complex-cutting') {
        processing = 'complex-cutting';
      } else if (selectedProcessing === 'bubble-free-adhesion') {
        processing = 'none';
        adhesion = 'bond-mugipo-45';
      } else if (selectedProcessing === 'edge-finishing') {
        processing = 'none';
        edgeRequested = true;
      } else if (selectedProcessing === 'laser-cutting-simple') {
        processing = 'laser-cutting-simple';
      } else if (selectedProcessing === 'laser-simple') {
        processing = 'laser-simple';
      } else if (selectedProcessing === 'laser-complex') {
        processing = 'laser-complex';
      } else if (selectedProcessing === 'laser-cutting-full') {
        processing = 'laser-cutting-full';
      } else if (selectedProcessing === 'laser-full') {
        processing = 'laser-full';
      } else if (selectedProcessing === 'cnc-general') {
        processing = 'cnc-general';
      } else if (selectedProcessing === 'cnc-heavy') {
        processing = 'cnc-heavy';
      } else if (selectedProcessing === 'cnc-simple') {
        processing = 'cnc-simple';
      } else if (selectedProcessing === 'cnc-complex') {
        processing = 'cnc-complex';
      } else if (selectedProcessing === 'cnc-full') {
        processing = 'cnc-full';
      } else if (selectedProcessing === 'complex-shapes') {
        processing = 'complex-shapes';
      } else if (selectedProcessing === 'none' || selectedProcessing === '') {
        processing = 'none';
      }

      if (selectedAdhesion === 'bond-normal') {
        adhesion = 'bond-normal';
      } else if (selectedAdhesion === 'bond-mugipo-auto') {
        adhesion = 'auto';
      } else if (selectedAdhesion === 'bond-mugipo-45') {
        adhesion = 'bond-mugipo-45';
      } else if (selectedAdhesion === 'bond-mugipo-90') {
        adhesion = 'bond-mugipo-90';
      } else if (selectedAdhesion === '45-normal') {
        adhesion = '45-normal';
      } else if (selectedAdhesion === '45-mugipo') {
        adhesion = '45-mugipo';
      } else if (selectedAdhesion === '90-normal') {
        adhesion = '90-normal';
      } else if (selectedAdhesion === '90-mugipo') {
        adhesion = '90-mugipo';
      } else if (selectedAdhesion === 'none' || selectedAdhesion === '') {
        adhesion = 'none';
      }

      const hasProcessingSelections =
        (!!selectedProcessing && selectedProcessing !== 'none') ||
        (!!selectedAdhesion && selectedAdhesion !== 'none') ||
        Object.values(selectedAdditionalOptions).some(quantity => quantity > 0) ||
        edgeRequested ||
        bevelLengthM > 0 ||
        polishedEdgeLengthM > 0 ||
        laserHoles > 0 ||
        corners90 > 0 ||
        edgeFinishing ||
        bulgwang ||
        tapung ||
        mugwangPainting;

      if (hasProcessingSelections) {
        const representativeSelection = selectedSizes.find(sizeSelection => sizeSelection.quantity > 0) || selectedSizes[0];
        const representativeSizeMatch = representativeSelection?.size.match(/^([^(]+)/);
        const representativeSize = representativeSizeMatch
          ? representativeSizeMatch[1].trim()
          : representativeSelection?.size || selectedSize;
        const representativeSurface = representativeSelection?.surface || '단면';
        const optionProcessingType =
          selectedProcessing && selectedProcessing !== 'none'
            ? selectedProcessing
            : undefined;

        // 가공 옵션 비용만 계산한다. 기준 금액은 이미 계산된 총 원장 금액을 사용하되,
        // 화면에 선택하지 않은 규격(예: 소3*6)이 노출되지 않도록 실제 선택 규격을 넘긴다.
        const optionsResult = calculatePrice(
          selectedMaterial.id,
          selectedQuality.id,
          selectedThickness,
          representativeSize,
          representativeSurface,
          selectedColorType || undefined,
          optionProcessingType,
          0, // 조색비 0
          {
            processing,
            adhesion,
            qty,
            isComplex,
            edgeRequested,
            bevelLengthM,
            polishedEdgeLengthM,
            bevelFeePerM: bevelLengthM > 0 ? bevelFeePerM : undefined,
            laserHoles,
            holeFee: laserHoles > 0 ? laserHoleFee : undefined,
            corners90: 0,
            useDetailedBond: false,
            joinLengthM: 0,
            trayHeightMm: undefined,
            bondProductType: 'flat',
            adhesionBasis: 'sheet_based',
            adhesionConfig,
            edgeFinishing,
            bulgwang,
            tapung,
            mugwangPainting,
            processingOptionsData: processingOptions,
            colorMixingCostsData: colorMixingCosts?.map(c => ({ thickness: c.thickness, cost: c.cost })),
            panelSizesData: toPanelSizeData(activePanelSizes),
            basePanelSizesData: toPanelSizeData(clearPanelSizes),
            optionSurchargesData: optionSurcharges as any,
            rawOnlyMultiplier,
            formulaConstants,
            selectedAdditionalOptions,
            selectedPanelSizesForOptions: selectedSizes.map(sizeSelection => ({
              size: sizeSelection.size,
              quantity: sizeSelection.quantity,
            })),
            // 총 원장을 기준가격으로 전달
            totalWonJangBase: totalWonJang,
            strictPanelCatalog: true,
          }
        );

        // 가공 옵션 breakdown만 추출
        const optionsBreakdown = optionsResult.breakdown.filter(item => {
          const source = item.source || classifyCalculationLineItem(item);
          return source === 'processing'
            || source === 'adhesion'
            || source === 'additional'
            || source === 'post_processing'
            || source === 'mirror'
            || source === 'outsourcing'
            || source === 'validation';
        });

        allBreakdown.push(...optionsBreakdown);
        totalPrice += optionsBreakdown.reduce((sum, item) => sum + item.price, 0);
        aggregateWarnings.push(...optionsResult.warnings);
        aggregateBlockedReasons.push(...optionsResult.blockedReasons);
      }

      console.log('Multi-size price calculation result:', { 
        totalWonJang, 
        totalPrice, 
        breakdown: allBreakdown 
      });
      setPriceInfo({
        totalPrice,
        breakdown: allBreakdown,
        status: aggregateBlockedReasons.length > 0 ? 'blocked' : aggregateWarnings.length > 0 ? 'needs_review' : 'calculable',
        lineItems: allBreakdown.map((item, index) => ({
          code: item.code || `${item.source || classifyCalculationLineItem(item)}-${index + 1}`,
          label: item.label,
          amount: item.price,
          source: item.source || classifyCalculationLineItem(item),
          reason: item.reason,
        })),
        warnings: Array.from(new Set(aggregateWarnings)),
        blockedReasons: Array.from(new Set(aggregateBlockedReasons)),
        snapshotVersion: 'pricing-engine-v2-core-260520',
        formulaDocVersion: 260520,
      });
    }
    // 단일 선택된 사이즈가 있는 경우 (하위 호환성)
    else if (selectedMaterial && selectedQuality && selectedThickness && selectedSize && selectedFactory === 'jangwon') {
      const surface = selectedSurface || '단면';
      let singleProcessing: ProcessingProfile = 'none';
      let singleAdhesion: AdhesionProfile = 'none';
      const singleEdgeRequested = selectedProcessing === 'edge-finishing';

      if (selectedProcessing === 'auto') singleProcessing = 'auto';
      else if (selectedProcessing === 'simple-cutting') singleProcessing = 'simple-cutting';
      else if (selectedProcessing === 'complex-cutting') singleProcessing = 'complex-cutting';
      else if (selectedProcessing === 'bubble-free-adhesion') singleAdhesion = 'bond-mugipo-45';
      else if (selectedProcessing === 'laser-cutting-simple') singleProcessing = 'laser-cutting-simple';
      else if (selectedProcessing === 'laser-simple') singleProcessing = 'laser-simple';
      else if (selectedProcessing === 'laser-complex') singleProcessing = 'laser-complex';
      else if (selectedProcessing === 'laser-cutting-full') singleProcessing = 'laser-cutting-full';
      else if (selectedProcessing === 'laser-full') singleProcessing = 'laser-full';
      else if (selectedProcessing === 'cnc-general') singleProcessing = 'cnc-general';
      else if (selectedProcessing === 'cnc-heavy') singleProcessing = 'cnc-heavy';
      else if (selectedProcessing === 'cnc-simple') singleProcessing = 'cnc-simple';
      else if (selectedProcessing === 'cnc-complex') singleProcessing = 'cnc-complex';
      else if (selectedProcessing === 'cnc-full') singleProcessing = 'cnc-full';
      else if (selectedProcessing === 'complex-shapes') singleProcessing = 'complex-shapes';

      if (selectedAdhesion === 'bond-normal') singleAdhesion = 'bond-normal';
      else if (selectedAdhesion === 'bond-mugipo-auto') singleAdhesion = 'auto';
      else if (selectedAdhesion === 'bond-mugipo-45') singleAdhesion = 'bond-mugipo-45';
      else if (selectedAdhesion === 'bond-mugipo-90') singleAdhesion = 'bond-mugipo-90';
      else if (selectedAdhesion === '45-normal') singleAdhesion = '45-normal';
      else if (selectedAdhesion === '45-mugipo') singleAdhesion = '45-mugipo';
      else if (selectedAdhesion === '90-normal') singleAdhesion = '90-normal';
      else if (selectedAdhesion === '90-mugipo') singleAdhesion = '90-mugipo';
      
      const result = calculatePrice(
        selectedMaterial.id,
        selectedQuality.id,
        selectedThickness,
        selectedSize,
        surface,
        selectedColorType || undefined,
        selectedProcessing || undefined,
        colorMixingCost,
        {
          processingOptionsData: processingOptions || [],
          colorMixingCostsData: colorMixingCosts?.map(c => ({ thickness: c.thickness, cost: c.cost })),
          panelSizesData: toPanelSizeData(activePanelSizes),
          basePanelSizesData: toPanelSizeData(clearPanelSizes),
          optionSurchargesData: optionSurcharges as any,
          rawOnlyMultiplier,
          formulaConstants,
          selectedAdditionalOptions,
          processing: singleProcessing,
          adhesion: singleAdhesion,
          qty,
          isComplex,
          edgeRequested: singleEdgeRequested,
          bevelLengthM,
          polishedEdgeLengthM,
          bevelFeePerM: bevelLengthM > 0 ? bevelFeePerM : undefined,
          laserHoles,
          holeFee: laserHoles > 0 ? laserHoleFee : undefined,
          corners90: 0,
          useDetailedBond: false,
          joinLengthM: 0,
          trayHeightMm: undefined,
          bondProductType: 'flat',
          adhesionBasis: 'sheet_based',
          adhesionConfig,
          edgeFinishing,
          bulgwang,
          tapung,
          mugwangPainting,
          strictPanelCatalog: true,
        }
      );
      
      console.log('Single-size price calculation result:', result);
      setPriceInfo(result);
    } else {
      console.log('Price calculation skipped - missing required fields or not Jangwon factory');
      setPriceInfo(EMPTY_PRICE_INFO);
    }
  }, [
    selectedFactory, 
    selectedMaterial, 
    selectedQuality, 
    selectedThickness, 
    selectedSize,
    selectedSizes,
    selectedColorType, 
    selectedSurface, 
    colorMixingCost, 
    selectedProcessing, 
    selectedAdhesion,
    selectedAdditionalOptions,
    qty,
    isComplex,
    bevelLengthM,
    polishedEdgeLengthM,
    laserHoles,
    corners90,
    useDetailedBond,
    joinLengthM,
    trayHeightMm,
    bondProductType,
    edgeFinishing,
    bulgwang,
    tapung,
    mugwangPainting,
    processingOptions,
    colorMixingCosts,
    activePanelSizes,
    clearPanelSizes,
    optionSurcharges,
    advancedSettings, // 관리자 설정 변경 시 재계산
  ]);

  return {
    priceInfo,
    hasPriceData,
    getAvailableSizes
  };
};
