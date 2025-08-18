
export interface PriceEntry {
  materialId: string;
  qualityId: string;
  thickness: string;
  size: string;
  surface: string;
  colorType?: string; // 진백/컬러 옵션 추가
  price: number;
}

export interface PricingData {
  [key: string]: number; // 키는 "materialId-qualityId-thickness-size-surface-colorType" 형태
}

// 가격 키 생성 함수 (colorType 옵션 추가)
export const createPriceKey = (
  materialId: string,
  qualityId: string,
  thickness: string,
  size: string,
  surface: string,
  colorType?: string
): string => {
  const baseKey = `${materialId}-${qualityId}-${thickness}-${size}-${surface}`;
  return colorType ? `${baseKey}-${colorType}` : baseKey;
};

// 가격 키 파싱 함수
export const parsePriceKey = (key: string): PriceEntry => {
  const parts = key.split('-');
  if (parts.length === 6) {
    const [materialId, qualityId, thickness, size, surface, colorType] = parts;
    return { materialId, qualityId, thickness, size, surface, colorType, price: 0 };
  } else {
    const [materialId, qualityId, thickness, size, surface] = parts;
    return { materialId, qualityId, thickness, size, surface, price: 0 };
  }
};
