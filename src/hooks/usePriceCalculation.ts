
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Material, Quality } from "@/types/calculator";
import { calculatePrice } from "@/utils/priceCalculations";
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
  trayHeightMm
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
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedQuality?.id
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

        // 할증 없이 기본 가격만 계산하기 위해 inquiryType을 임시로 설정하지 않음
        let processing: any = 'none';
        let adhesion: any = 'none';
        let edgeRequested = false;
        
        if (selectedProcessing === 'auto') {
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
        } else if (selectedProcessing === 'cnc-simple') {
          processing = 'cnc-simple';
        } else if (selectedProcessing === 'cnc-complex') {
          processing = 'cnc-complex';
        } else if (selectedProcessing === 'none') {
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
        } else if (selectedAdhesion === 'none') {
          adhesion = 'none';
        }

        // 할증을 적용하지 않고 기본 가격만 계산
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
            inquiryType: 'with-processing', // 기본값 설정하지만 할증은 나중에 한 번만 적용
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
          }
        );

        // breakdown에서 할증 항목 제외하고 추가
        const filteredBreakdown = result.breakdown.filter(item => 
          !item.label.includes('할증') && !item.label.includes('원장 단독')
        );
        
        // 할증 항목 찾기 (첫 번째 사이즈에서만)
        if (index === 0) {
          const inquiryItem = result.breakdown.find(item => 
            item.label.includes('할증') || item.label.includes('원장 단독')
          );
          if (inquiryItem) {
            // 할증 배수 추출 (예: "×1.2" -> 1.2)
            const match = inquiryItem.label.match(/×([\d.]+)/);
            if (match) {
              inquiryMultiplier = parseFloat(match[1]);
            }
          }
        }

        // 개별 breakdown에 사이즈 정보 추가
        const labeledBreakdown = filteredBreakdown.map(item => ({
          label: `[${actualSize} #${index + 1}] ${item.label}`,
          price: item.price
        }));

        allBreakdown.push(...labeledBreakdown);
        
        // 할증 제외한 가격 합산
        const basePrice = filteredBreakdown.reduce((sum, item) => sum + item.price, 0);
        totalBasePrice += basePrice;
      });

      // 모든 기본 가격 합산 후 할증 1회 적용
      let totalPrice = totalBasePrice;
      if (inquiryMultiplier > 0) {
        const inquiryDelta = totalBasePrice * (inquiryMultiplier - 1);
        const inquiryLabel = selectedProcessing === 'raw-only' 
          ? `원장 단독 구매 할증 (×${inquiryMultiplier})`
          : `가공 포함 문의 할증 (×${inquiryMultiplier})`;
        
        allBreakdown.push({ label: inquiryLabel, price: inquiryDelta });
        totalPrice += inquiryDelta;
      }

      console.log('Multi-size price calculation result:', { totalPrice, breakdown: allBreakdown });
      setPriceInfo({ totalPrice, breakdown: allBreakdown });
    }
    // 단일 선택된 사이즈가 있는 경우 (하위 호환성)
    else if (selectedMaterial && selectedQuality && selectedThickness && selectedSize && selectedFactory === 'jangwon') {
      const surface = selectedSurface || '단면';
      
      let processing: any = 'none';
      let adhesion: any = 'none';
      let inquiryType: 'with-processing' | 'raw-only' = 'with-processing';
      let edgeRequested = false;
      
      if (selectedProcessing === 'raw-only') {
        inquiryType = 'raw-only';
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
      } else if (selectedProcessing === 'cnc-simple') {
        processing = 'cnc-simple';
      } else if (selectedProcessing === 'cnc-complex') {
        processing = 'cnc-complex';
      } else if (selectedProcessing === 'none') {
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
      } else if (selectedAdhesion === 'none') {
        adhesion = 'none';
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
          inquiryType,
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
    trayHeightMm
  ]);

  return {
    priceInfo,
    hasPriceData,
    getAvailableSizes
  };
};
