
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
    
    // 실제 크기 정보를 포함한 사이즈 매핑 (10T~20T 기준 치수)
    const getSizeWithDimensions = (baseSize: string): string => {
      const sizeMapping: { [key: string]: string } = {
        '3*6': '3*6 (900*1800)',
        '대3*6': '대3*6 (950*1850)',
        '4*5': '4*5 (1170*1475)',
        '대4*5': '대4*5 (1250*1550)',
        '1*2': '1*2 (1050*2050)',
        '4*6': '4*6 (1250*1900)',
        '4*8': '4*8 (1250*2450)',
        '4*10': '4*10 (1250*3050)',
        '5*5': '5*5 (1550*1550)',
        '5*6': '5*6 (1550*1850)',
        '5*8': '5*8 (1550*2450)',
        '소3*6': '소3*6 (900*1800)',
        '소1*2': '소1*2 (1050*2050)'
      };
      return sizeMapping[baseSize] || baseSize;
    };
    
    // 15T 두께에 대한 특별한 사이즈 배열 (클리어와 브라이트만) - 10T~20T 기준 치수
    if (selectedThickness === '15T' && (selectedQuality.id === 'glossy-color' || selectedQuality.id === 'satin-color')) {
      return [
        '3*6 (900*1800)',
        '대3*6 (950*1850)', 
        '4*5 (1170*1475)',
        '대4*5 (1250*1550)',
        '1*2 (1050*2050)',
        '4*6 (1250*1900)',
        '4*8 (1250*2450)',
        '4*10 (1250*3050)',
        '5*6 (1550*1850)',
        '5*8 (1550*2450)'
      ];
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
