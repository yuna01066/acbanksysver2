
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Material, Quality } from "@/types/calculator";
import { calculatePrice, ProcessingOptionData } from "@/utils/priceCalculations";
import { 
  glossyColorSinglePrices, 
  glossyStandardSinglePrices, 
  astelColorSinglePrices,
  satinColorSinglePrices
} from "@/data/glossyColorPricing";

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
  // V2 고급 옵션
  qty?: number;
  isComplex?: boolean;
  bevelLengthM?: number;
  laserHoles?: number;
  corners90?: number;
  useDetailedBond?: boolean;
  joinLengthM?: number;
  trayHeightMm?: number;
  edgeFinishing?: boolean;
  bulgwang?: boolean;
  tapung?: boolean;
  mugwangPainting?: boolean;
}

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
  // V2 고급 옵션
  qty = 1,
  isComplex = false,
  bevelLengthM = 0,
  laserHoles = 0,
  corners90 = 0,
  useDetailedBond = false,
  joinLengthM = 0,
  trayHeightMm,
  edgeFinishing = false,
  bulgwang = false,
  tapung = false,
  mugwangPainting = false
}: UsePriceCalculationProps) => {
  const [priceInfo, setPriceInfo] = useState<{ totalPrice: number; breakdown: { label: string; price: number }[] }>({
    totalPrice: 0,
    breakdown: []
  });

  // Fetch panel master for the selected quality
  const { data: panelMaster } = useQuery({
    queryKey: ['panel-master-for-calc', selectedQuality?.id],
    queryFn: async () => {
      if (!selectedQuality?.id) return null;
      
      const { data, error } = await supabase
        .from('panel_masters')
        .select('*')
        .eq('quality', selectedQuality.id as any)
        .maybeSingle();

      if (error) {
        console.error('Error fetching panel master:', error);
        return null;
      }

      return data;
    },
  });

  // Fetch active processing options
  const { data: processingOptions } = useQuery({
    queryKey: ['processing-options', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processing_options')
        .select('option_id, name, multiplier, base_cost')
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching processing options:', error);
        return [];
      }

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

  // Fetch adhesive costs
  const { data: adhesiveCosts } = useQuery({
    queryKey: ['adhesive-costs-calc', panelMaster?.id],
    queryFn: async () => {
      if (!panelMaster?.id) return [];
      
      const { data, error } = await supabase
        .from('adhesive_costs')
        .select('*')
        .eq('panel_master_id', panelMaster.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!panelMaster?.id
  });

  // 특정 두께와 사이즈 조합에 가격 데이터가 있는지 확인하는 함수
  const hasPriceData = (qualityId: string, thickness: string, size: string): boolean => {
    if (selectedFactory !== 'jangwon') return false;
    
    let priceData;
    
    switch (qualityId) {
      case 'glossy-color':
        priceData = glossyColorSinglePrices;
        break;
      case 'glossy-standard':
        priceData = glossyStandardSinglePrices;
        break;
      case 'astel-color':
        priceData = astelColorSinglePrices;
        break;
      case 'satin-color':
        priceData = satinColorSinglePrices;
        break;
      default:
        return false;
    }

    const thicknessData = priceData[thickness as keyof typeof priceData];
    if (!thicknessData) return false;
    
    const price = thicknessData[size as keyof typeof thicknessData];
    return price !== undefined && price > 0;
  };

  // 사용 가능한 사이즈 필터링 함수
  const getAvailableSizes = (): string[] => {
    if (!selectedQuality || !selectedThickness) return [];
    
  // 두께별 가용 사이즈 계산 (실제 치수 포함)
  const getSizeWithDimensions = (baseSize: string, actualWidth?: number, actualHeight?: number): string => {
    // DB에서 가져온 실제 치수가 있으면 사용
    if (actualWidth && actualHeight) {
      return `${baseSize} (${actualWidth}*${actualHeight})`;
    }

    // 10T~20T 기준 치수 매핑 (fallback)
    const baseSizeMapping: { [key: string]: { width: number; height: number } } = {
      '3*6': { width: 860, height: 1750 },
      '대3*6': { width: 900, height: 1800 },
      '4*5': { width: 1120, height: 1425 },
      '대4*5': { width: 1200, height: 1500 },
      '1*2': { width: 1000, height: 2000 },
      '4*6': { width: 1200, height: 1800 },
      '4*8': { width: 1200, height: 2400 },
      '4*10': { width: 1200, height: 3000 },
      '5*6': { width: 1500, height: 1800 },
      '5*8': { width: 1500, height: 2400 }
    };

    const baseInfo = baseSizeMapping[baseSize];
    if (!baseInfo) return baseSize;

    // 두께에 따른 실제 가용 사이즈 계산
    const thickness = parseFloat(selectedThickness?.replace('T', '') || '0');
    let calculatedWidth = baseInfo.width;
    let calculatedHeight = baseInfo.height;

    if (thickness >= 1.3 && thickness < 10) {
      // 1.3T ~ 10T 미만: 10T~20T 기준에서 20mm 더하기
      calculatedWidth += 20;
      calculatedHeight += 20;
    } else if (thickness >= 10 && thickness <= 20) {
      // 10T ~ 20T: 기준 사이즈 그대로
      // 변경 없음
    } else if (thickness >= 20 && thickness <= 30) {
      // 20T ~ 30T: 10T~20T 기준에서 50mm 빼기
      calculatedWidth -= 50;
      calculatedHeight -= 50;
    }

    return `${baseSize} (${calculatedWidth}*${calculatedHeight})`;
  };

  // DB에 활성화된 사이즈가 있으면 그것을 사용
  if (activePanelSizes && activePanelSizes.length > 0) {
    return activePanelSizes.map(ps => 
      getSizeWithDimensions(ps.size_name, ps.actual_width || undefined, ps.actual_height || undefined)
    );
  }
    
    // 15T 두께에 대한 특별한 사이즈 배열 (두께별 실제 치수 적용)
    if (selectedThickness === '15T' && (selectedQuality.id === 'glossy-color' || selectedQuality.id === 'satin-color')) {
      const specialSizes = [
        '3*6', '대3*6', '4*5', '대4*5', '1*2', '4*6', '4*8', '4*10', '5*6', '5*8'
      ];
      return specialSizes.map(size => getSizeWithDimensions(size));
    }
    
    // 다른 두께들에 대해서는 기본 사이즈에 크기 정보 추가
    if (selectedFactory === 'jangwon') {
      return selectedQuality.sizes
        .filter(size => hasPriceData(selectedQuality.id, selectedThickness, size))
        .map(size => getSizeWithDimensions(size));
    }
    
    return selectedQuality.sizes.map(size => getSizeWithDimensions(size));
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
    const rawOnlyMultiplier = advancedSettings?.find(s => s.setting_key === 'raw_only_multiplier')?.setting_value || 1.8;

    // 다중 선택된 사이즈가 있는 경우
    if (selectedMaterial && selectedQuality && selectedThickness && selectedSizes && selectedSizes.length > 0 && selectedFactory === 'jangwon') {
      let totalBasePrice = 0; // 할증 전 기본 가격 합계
      let allBreakdown: { label: string; price: number }[] = [];
      let inquiryMultiplier = 0; // 할증 배수

      // 각 사이즈별로 기본 가격 계산 (할증 제외)
      selectedSizes.forEach((sizeSelection, index) => {
        const surface = sizeSelection.surface || '단면';
        const sizeColorMixingCost = sizeSelection.colorMixingCost || 0;
        
        // 사이즈 문자열에서 실제 사이즈 부분만 추출
        const sizeMatch = sizeSelection.size.match(/^([^\(]+)/);
        const actualSize = sizeMatch ? sizeMatch[1].trim() : sizeSelection.size;

        // 가공/접착 프로필 결정
        let processing: any = 'none';
        let adhesion: any = 'none';
        let edgeRequested = false;
        
        if (selectedProcessing === 'raw-only') {
          processing = 'none';
        } else if (selectedProcessing === 'auto') {
          processing = 'auto';
        } else if (selectedProcessing === 'simple-cutting') {
          processing = 'simple-cutting';
        } else if (selectedProcessing === 'edge-finishing') {
          processing = 'none';
          edgeRequested = true;
      } else if (selectedProcessing === 'laser-simple') {
        processing = 'laser-simple';
      } else if (selectedProcessing === 'laser-complex') {
        processing = 'laser-complex';
      } else if (selectedProcessing === 'laser-full') {
        processing = 'laser-full';
      } else if (selectedProcessing === 'cnc-simple') {
        processing = 'cnc-simple';
      } else if (selectedProcessing === 'cnc-complex') {
        processing = 'cnc-complex';
      } else if (selectedProcessing === 'cnc-full') {
        processing = 'cnc-full';
      } else if (selectedProcessing === 'none' || selectedProcessing === '') {
        processing = 'none';
      }

      // 접착 옵션 매핑 - DB option_id를 그대로 사용
      if (selectedAdhesion === 'bond-normal') {
        adhesion = 'bond-normal';
      } else if (selectedAdhesion === 'bond-mugipo-auto') {
        adhesion = 'auto';
      } else if (selectedAdhesion === 'bond-mugipo-45') {
        adhesion = 'bond-mugipo-45';
      } else if (selectedAdhesion === 'bond-mugipo-90') {
        adhesion = 'bond-mugipo-90';
      } else if (selectedAdhesion === 'none' || selectedAdhesion === '') {
        adhesion = 'none';
      } else {
        // 기타 DB의 접착 옵션들은 그대로 전달
        adhesion = selectedAdhesion as any;
      }

        // 가격 계산
        const result = calculatePrice(
          selectedMaterial.id,
          selectedQuality.id,
          selectedThickness,
          actualSize,
          surface,
          selectedColorType || undefined,
          selectedProcessing || undefined,
          sizeColorMixingCost,
          {
            processing,
            adhesion,
            qty: sizeSelection.quantity,
            isComplex,
            edgeRequested,
            bevelLengthM,
            bevelFeePerM: bevelLengthM > 0 ? 3000 : undefined,
            laserHoles,
            holeFee: laserHoles > 0 ? 500 : undefined,
            corners90,
            useDetailedBond,
            joinLengthM,
            trayHeightMm,
            edgeFinishing,
            colorMixingCostsData: colorMixingCosts?.map(c => ({ thickness: c.thickness, cost: c.cost })),
            adhesiveCostsData: adhesiveCosts?.map(c => ({ thickness: c.thickness, cost: c.cost })),
            panelSizesData: activePanelSizes?.map(ps => ({
              size_name: ps.size_name,
              thickness: ps.thickness,
              price: ps.price || undefined,
              is_active: ps.is_active
            })),
            processingOptionsData: processingOptions, // DB에서 가져온 가공 옵션 전달
            rawOnlyMultiplier, // DB에서 가져온 원판 단독 구매 할증률 전달
          }
        );

        // 개별 breakdown에 사이즈 정보 추가
        const labeledBreakdown = result.breakdown.map(item => ({
          label: `[${actualSize} #${index + 1}] ${item.label}`,
          price: item.price
        }));

        allBreakdown.push(...labeledBreakdown);
        
        // 전체 가격 합산
        const itemTotal = result.breakdown.reduce((sum, item) => sum + item.price, 0);
        totalBasePrice += itemTotal;
      });

      // 최종 총 가격
      let totalPrice = totalBasePrice;

      console.log('Multi-size price calculation result:', { totalPrice, breakdown: allBreakdown });
      setPriceInfo({ totalPrice, breakdown: allBreakdown });
    }
    // 단일 선택된 사이즈가 있는 경우 (하위 호환성)
    else if (selectedMaterial && selectedQuality && selectedThickness && selectedSize && selectedFactory === 'jangwon') {
      const surface = selectedSurface || '단면';
      
      let processing: any = 'none';
      let adhesion: any = 'none';
      let edgeRequested = false;
      
      if (selectedProcessing === 'raw-only') {
        processing = 'none';
      } else if (selectedProcessing === 'auto') {
        processing = 'auto';
      } else if (selectedProcessing === 'simple-cutting') {
        processing = 'simple-cutting';
      } else if (selectedProcessing === 'edge-finishing') {
        processing = 'none';
        edgeRequested = true;
      } else if (selectedProcessing === 'laser-simple') {
        processing = 'laser-simple';
      } else if (selectedProcessing === 'laser-complex') {
        processing = 'laser-complex';
      } else if (selectedProcessing === 'laser-full') {
        processing = 'laser-full';
      } else if (selectedProcessing === 'cnc-simple') {
        processing = 'cnc-simple';
      } else if (selectedProcessing === 'cnc-complex') {
        processing = 'cnc-complex';
      } else if (selectedProcessing === 'cnc-full') {
        processing = 'cnc-full';
      } else if (selectedProcessing === 'none' || selectedProcessing === '') {
        processing = 'none';
      }

      // 접착 옵션 매핑 - DB option_id를 그대로 사용
      if (selectedAdhesion === 'bond-normal') {
        adhesion = 'bond-normal';
      } else if (selectedAdhesion === 'bond-mugipo-auto') {
        adhesion = 'auto';
      } else if (selectedAdhesion === 'bond-mugipo-45') {
        adhesion = 'bond-mugipo-45';
      } else if (selectedAdhesion === 'bond-mugipo-90') {
        adhesion = 'bond-mugipo-90';
      } else if (selectedAdhesion === 'none' || selectedAdhesion === '') {
        adhesion = 'none';
      } else {
        // 기타 DB의 접착 옵션들은 그대로 전달
        adhesion = selectedAdhesion as any;
      }

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
          processing,
          adhesion,
          qty,
          isComplex,
          edgeRequested,
          bevelLengthM,
          bevelFeePerM: bevelLengthM > 0 ? 3000 : undefined,
          laserHoles,
          holeFee: laserHoles > 0 ? 500 : undefined,
          corners90,
          useDetailedBond,
          joinLengthM,
          trayHeightMm,
          edgeFinishing,
          bulgwang,
          tapung,
          mugwangPainting,
          processingOptionsData: processingOptions || [],
          colorMixingCostsData: colorMixingCosts?.map(c => ({ thickness: c.thickness, cost: c.cost })),
          adhesiveCostsData: adhesiveCosts?.map(c => ({ thickness: c.thickness, cost: c.cost })),
          panelSizesData: activePanelSizes?.map(ps => ({
            size_name: ps.size_name,
            thickness: ps.thickness,
            price: ps.price || undefined,
            is_active: ps.is_active
          })),
          rawOnlyMultiplier, // DB에서 가져온 원판 단독 구매 할증률 전달
        }
      );
      
      console.log('Single-size price calculation result:', result);
      setPriceInfo(result);
    } else {
      console.log('Price calculation skipped - missing required fields or not Jangwon factory');
      setPriceInfo({ totalPrice: 0, breakdown: [] });
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
    processingOptions,
    colorMixingCosts,
    adhesiveCosts,
    activePanelSizes,
    advancedSettings, // 관리자 설정 변경 시 재계산
  ]);

  return {
    priceInfo,
    hasPriceData,
    getAvailableSizes
  };
};
