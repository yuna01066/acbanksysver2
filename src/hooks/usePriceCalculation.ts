
import { useState, useEffect } from 'react';
import { Material, Quality } from "@/types/calculator";
import { calculatePrice } from "@/utils/priceCalculations";
import { 
  glossyColorSinglePrices, 
  glossyStandardSinglePrices, 
  astelColorSinglePrices,
  satinColorSinglePrices
} from "@/data/glossyColorPricing";

interface UsePriceCalculationProps {
  selectedFactory: string;
  selectedMaterial: Material | null;
  selectedQuality: Quality | null;
  selectedThickness: string;
  selectedSize: string;
  selectedColorType: string;
  selectedSurface: string;
  colorMixingCost: number;
  selectedProcessing: string;
}

export const usePriceCalculation = ({
  selectedFactory,
  selectedMaterial,
  selectedQuality,
  selectedThickness,
  selectedSize,
  selectedColorType,
  selectedSurface,
  colorMixingCost,
  selectedProcessing
}: UsePriceCalculationProps) => {
  const [priceInfo, setPriceInfo] = useState<{ totalPrice: number; breakdown: { label: string; price: number }[] }>({
    totalPrice: 0,
    breakdown: []
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
  const getSizeWithDimensions = (baseSize: string): string => {
    // 10T~20T 기준 치수 매핑
    const baseSizeMapping: { [key: string]: { width: number; height: number } } = {
      '3*6': { width: 900, height: 1800 },
      '대3*6': { width: 950, height: 1850 },
      '4*5': { width: 1170, height: 1475 },
      '대4*5': { width: 1250, height: 1550 },
      '1*2': { width: 1050, height: 2050 },
      '4*6': { width: 1250, height: 1900 },
      '4*8': { width: 1200, height: 2400 },
      '4*10': { width: 1250, height: 3050 },
      '5*5': { width: 1550, height: 1550 },
      '5*6': { width: 1550, height: 1850 },
      '5*8': { width: 1550, height: 2450 },
      '소3*6': { width: 900, height: 1800 },
      '소1*2': { width: 1050, height: 2050 }
    };

    const baseInfo = baseSizeMapping[baseSize];
    if (!baseInfo) return baseSize;

    // 두께에 따른 실제 가용 사이즈 계산
    const thickness = parseFloat(selectedThickness?.replace('T', '') || '0');
    let actualWidth = baseInfo.width;
    let actualHeight = baseInfo.height;

    if (thickness >= 1.3 && thickness < 10) {
      // 1.3T ~ 10T 미만: 10T~20T 기준에서 20mm 더하기
      actualWidth += 20;
      actualHeight += 20;
    } else if (thickness >= 10 && thickness <= 20) {
      // 10T ~ 20T: 기준 사이즈 그대로
      // 변경 없음
    } else if (thickness >= 20 && thickness <= 30) {
      // 20T ~ 30T: 10T~20T 기준에서 50mm 빼기
      actualWidth -= 50;
      actualHeight -= 50;
    }

    return `${baseSize} (${actualWidth}*${actualHeight})`;
  };
    
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

  // 가격 계산 업데이트
  useEffect(() => {
    console.log('Price calculation triggered with:', {
      factory: selectedFactory,
      material: selectedMaterial?.id,
      quality: selectedQuality?.id,
      thickness: selectedThickness,
      size: selectedSize,
      colorType: selectedColorType,
      surface: selectedSurface,
      colorMixingCost: colorMixingCost,
      processing: selectedProcessing
    });

    if (selectedMaterial && selectedQuality && selectedThickness && selectedSize && selectedFactory === 'jangwon') {
      const surface = selectedSurface || '단면';
      const result = calculatePrice(
        selectedMaterial.id,
        selectedQuality.id,
        selectedThickness,
        selectedSize,
        surface,
        selectedColorType || undefined,
        selectedProcessing || undefined,
        colorMixingCost
      );
      
      console.log('Price calculation result:', result);
      setPriceInfo(result);
    } else {
      console.log('Price calculation skipped - missing required fields or not Jangwon factory');
      setPriceInfo({ totalPrice: 0, breakdown: [] });
    }
  }, [selectedFactory, selectedMaterial, selectedQuality, selectedThickness, selectedSize, selectedColorType, selectedSurface, colorMixingCost, selectedProcessing]);

  return {
    priceInfo,
    hasPriceData,
    getAvailableSizes
  };
};
