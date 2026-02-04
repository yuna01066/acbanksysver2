/**
 * Pluuug Estimate Item Mapping
 * 
 * 로컬 견적 계산기 항목과 Pluuug 견적서 항목 템플릿 ID 매핑
 */

// Pluuug 견적서 항목 분류 ID
export const PLUUUG_CLASSIFICATION_IDS = {
  MATERIAL: 2647,        // 재질
  COLOR: 2648,           // 컬러
  THICKNESS: 2649,       // 두께
  PANEL_SIZE: 2650,      // 판재 사이즈
  DOUBLE_SIDED: 2651,    // 양단면
  COLOR_MIXING: 2652,    // 조색비
  RAW_PURCHASE: 2653,    // 원판 구매
  SIMPLE_CUTTING: 2654,  // 단순 재단
  COMPLEX_CUTTING: 2655, // 복합 재단
  FULL_CUTTING: 2656,    // 전체 재단
  CUTTING_FACE: 2657,    // 접착면 가공
  ADHESION: 2658,        // 접착 가공
  MIRROR_COATING: 2659,  // 미러 증착
  PRINTING: 2660,        // 인쇄 가공
  ADDITIONAL: 2661,      // 추가 옵션
} as const;

// 로컬 재질(quality)과 Pluuug 항목 ID 매핑 - Pluuug API에서 확인된 실제 ID
export const MATERIAL_TO_PLUUUG_ITEM: Record<string, number> = {
  'glossy-color': 316870,    // Clear 클리어 (Glossy Color) - 확인됨
  'satin-color': 316873,     // Bright 브라이트 (Satin Color) - 확인됨
  'acrylic-mirror': 316874,  // Mirror 미러 (Mirror Acrylic) - 확인됨
  'astel-color': 316872,     // Astel 아스텔 (Astel Color) - 확인됨
  'astel-mirror': 316875,    // Astel Mirror 아스텔 미러 - 확인됨
};

// 로컬 processing_options의 option_id와 Pluuug 항목 ID 매핑
// 이 매핑은 Pluuug에 등록된 항목 템플릿 ID를 기반으로 함
export const PROCESSING_TO_PLUUUG_ITEM: Record<string, {
  pluuugItemId?: number;
  classificationId: number;
  title: string;
  unit: string;
}> = {
  // === 원판 구매 (slot1) ===
  'raw-only': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.RAW_PURCHASE,
    title: '원판 단독 구매',
    unit: '장',
  },
  
  // === 단순 재단 (slot2) ===
  'laser-simple': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.SIMPLE_CUTTING,
    title: '레이저 단순 재단',
    unit: 'EA',
  },
  'cnc-simple': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.SIMPLE_CUTTING,
    title: 'CNC 단순 재단',
    unit: 'EA',
  },
  
  // === 복합 재단 (slot3) ===
  'laser-complex': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.COMPLEX_CUTTING,
    title: '레이저 복합 재단',
    unit: 'EA',
  },
  'cnc-complex': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.COMPLEX_CUTTING,
    title: 'CNC 복합 재단',
    unit: 'EA',
  },
  
  // === 전체 재단 (slot4) ===
  'laser-full': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.FULL_CUTTING,
    title: '레이저 전체 재단',
    unit: 'EA',
  },
  'cnc-full': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.FULL_CUTTING,
    title: 'CNC 전체 재단',
    unit: 'EA',
  },
  
  // === 접착면 가공 (slot5) ===
  'cutting-45': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.CUTTING_FACE,
    title: '절단면 45°',
    unit: 'M',
  },
  'cutting-90': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.CUTTING_FACE,
    title: '절단면 90°',
    unit: 'M',
  },
  
  // === 접착 가공 (slot6) ===
  'bond-normal': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADHESION,
    title: '일반 접착',
    unit: 'EA',
  },
  'bond-mugipo-auto': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADHESION,
    title: '무기포 접착',
    unit: 'EA',
  },
  'bond-mugipo-45': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADHESION,
    title: '무기포 접착 (45°)',
    unit: 'EA',
  },
  'bond-mugipo-90': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADHESION,
    title: '무기포 접착 (90°)',
    unit: 'EA',
  },
  
  // === 추가 옵션 (additional) ===
  'edgeFinishing': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '엣지 경면 마감 10T 미만',
    unit: 'EA',
  },
  'edgeFinishing-10': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '엣지 경면 마감 10T 이상',
    unit: 'EA',
  },
  'color-dying-gradient': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '염색 그라데이션',
    unit: 'EA',
  },
  'bending': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '절곡',
    unit: 'EA',
  },
  'sanding': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '샌딩 마감',
    unit: 'EA',
  },
  'bulgwang': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '불광 마감',
    unit: 'EA',
  },
  'mugwangPainting': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '무광 도장',
    unit: 'EA',
  },
  'tagong': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '타공',
    unit: 'EA',
  },
  'half-tagong': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '반타공',
    unit: 'EA',
  },
  'tap-tagong': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '탭타공',
    unit: 'EA',
  },
  'drawing-cad': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '캐드 도면',
    unit: 'EA',
  },
  'design-fee': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '디자인비',
    unit: 'EA',
  },
  'Quick-delivery-truck': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '선불 퀵 화물 배송',
    unit: 'EA',
  },
  'post-s': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '선불 택배 배송 S',
    unit: 'EA',
  },
  'post-l': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '선불 택배 배송 L',
    unit: 'EA',
  },
  'discount': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '할인',
    unit: 'EA',
  },
  
  // === 인쇄 가공 ===
  'silkscreen-1': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.PRINTING,
    title: '실크 인쇄 1도',
    unit: 'EA',
  },
  'uv-backprint': {
    classificationId: PLUUUG_CLASSIFICATION_IDS.PRINTING,
    title: 'UV 배면 인쇄',
    unit: 'EA',
  },
};

// 동적으로 Pluuug 항목 ID 캐시
let pluuugItemCache: Map<string, number> | null = null;

/**
 * Pluuug 항목 목록에서 제목으로 ID 검색
 */
export async function fetchAndCachePluuugItems(
  fetchPluuugItems: () => Promise<Array<{ id: number; title: string; classification: { id: number } }>>
): Promise<Map<string, number>> {
  if (pluuugItemCache) {
    return pluuugItemCache;
  }
  
  try {
    const items = await fetchPluuugItems();
    pluuugItemCache = new Map();
    
    items.forEach(item => {
      // 분류ID_제목 형태로 키 생성
      const key = `${item.classification.id}_${item.title}`;
      pluuugItemCache!.set(key, item.id);
      
      // 제목만으로도 검색 가능하도록
      pluuugItemCache!.set(item.title, item.id);
    });
    
    return pluuugItemCache;
  } catch (error) {
    console.error('[Pluuug Item Cache] Error:', error);
    return new Map();
  }
}

/**
 * 로컬 option_id로 Pluuug 항목 정보 조회
 */
export function getPluuugItemInfo(optionId: string): {
  pluuugItemId?: number;
  classificationId: number;
  title: string;
  unit: string;
} | null {
  return PROCESSING_TO_PLUUUG_ITEM[optionId] || null;
}

/**
 * 로컬 재질(quality)로 Pluuug 항목 ID 조회
 */
export function getPluuugMaterialItemId(qualityId: string): number | null {
  return MATERIAL_TO_PLUUUG_ITEM[qualityId] || null;
}

/**
 * 견적 breakdown 항목을 Pluuug 견적서 항목 형식으로 변환
 */
export interface PluuugEstimateItem {
  item?: { id: number };  // Pluuug 항목 템플릿 ID (있는 경우)
  title: string;
  quantity: number;
  unitCost: number;
  amount: number;
  description?: string;
  order: number;
}

export function convertBreakdownToPluuugItems(
  breakdown: Array<{ label: string; price: number }>,
  qualityId: string,
  processingOptions: string[], // 선택된 가공 옵션 ID들
  quantity: number = 1
): PluuugEstimateItem[] {
  const items: PluuugEstimateItem[] = [];
  let order = 1;
  
  breakdown.forEach(item => {
    const pluuugItem: PluuugEstimateItem = {
      title: item.label,
      quantity: quantity,
      unitCost: Math.round(item.price / quantity),
      amount: item.price,
      order: order++,
    };
    
    // 재질 항목인지 확인
    if (item.label.includes('원장') || item.label.includes('판재')) {
      const materialItemId = getPluuugMaterialItemId(qualityId);
      if (materialItemId) {
        pluuugItem.item = { id: materialItemId };
      }
    }
    
    // 가공 옵션 매칭
    processingOptions.forEach(optionId => {
      const optionInfo = getPluuugItemInfo(optionId);
      if (optionInfo && item.label.includes(optionInfo.title)) {
        if (optionInfo.pluuugItemId) {
          pluuugItem.item = { id: optionInfo.pluuugItemId };
        }
        pluuugItem.description = `분류: ${getCategoryName(optionInfo.classificationId)}`;
      }
    });
    
    items.push(pluuugItem);
  });
  
  return items;
}

/**
 * 분류 ID로 분류명 조회
 */
function getCategoryName(classificationId: number): string {
  const names: Record<number, string> = {
    [PLUUUG_CLASSIFICATION_IDS.MATERIAL]: '재질',
    [PLUUUG_CLASSIFICATION_IDS.COLOR]: '컬러',
    [PLUUUG_CLASSIFICATION_IDS.THICKNESS]: '두께',
    [PLUUUG_CLASSIFICATION_IDS.PANEL_SIZE]: '판재 사이즈',
    [PLUUUG_CLASSIFICATION_IDS.DOUBLE_SIDED]: '양단면',
    [PLUUUG_CLASSIFICATION_IDS.COLOR_MIXING]: '조색비',
    [PLUUUG_CLASSIFICATION_IDS.RAW_PURCHASE]: '원판 구매',
    [PLUUUG_CLASSIFICATION_IDS.SIMPLE_CUTTING]: '단순 재단',
    [PLUUUG_CLASSIFICATION_IDS.COMPLEX_CUTTING]: '복합 재단',
    [PLUUUG_CLASSIFICATION_IDS.FULL_CUTTING]: '전체 재단',
    [PLUUUG_CLASSIFICATION_IDS.CUTTING_FACE]: '접착면 가공',
    [PLUUUG_CLASSIFICATION_IDS.ADHESION]: '접착 가공',
    [PLUUUG_CLASSIFICATION_IDS.MIRROR_COATING]: '미러 증착',
    [PLUUUG_CLASSIFICATION_IDS.PRINTING]: '인쇄 가공',
    [PLUUUG_CLASSIFICATION_IDS.ADDITIONAL]: '추가 옵션',
  };
  return names[classificationId] || '기타';
}

/**
 * 견적서 전체를 Pluuug 형식으로 변환
 */
export function convertQuotesToPluuugEstimate(
  quotes: Array<{
    quality: string;
    breakdown: Array<{ label: string; price: number }>;
    processing?: string;
    quantity?: number;
  }>
): PluuugEstimateItem[] {
  const allItems: PluuugEstimateItem[] = [];
  let globalOrder = 1;
  
  quotes.forEach((quote, quoteIndex) => {
    const processingOptions = quote.processing?.split('|') || [];
    
    quote.breakdown.forEach(item => {
      const pluuugItem: PluuugEstimateItem = {
        title: item.label,
        quantity: quote.quantity || 1,
        unitCost: Math.round(item.price / (quote.quantity || 1)),
        amount: item.price,
        description: `견적 #${quoteIndex + 1}`,
        order: globalOrder++,
      };
      
      // 재질 매칭
      const materialItemId = getPluuugMaterialItemId(quote.quality);
      if (materialItemId && (item.label.includes('원장') || item.label.includes('판재'))) {
        pluuugItem.item = { id: materialItemId };
      }
      
      // 가공 옵션 매칭
      for (const optionId of processingOptions) {
        const optionInfo = getPluuugItemInfo(optionId);
        if (optionInfo) {
          // 항목 라벨에 옵션 이름이 포함되어 있는지 확인
          const normalizedLabel = item.label.replace(/\s/g, '').toLowerCase();
          const normalizedTitle = optionInfo.title.replace(/\s/g, '').toLowerCase();
          
          if (normalizedLabel.includes(normalizedTitle) || normalizedTitle.includes(normalizedLabel)) {
            if (optionInfo.pluuugItemId) {
              pluuugItem.item = { id: optionInfo.pluuugItemId };
            }
            break;
          }
        }
      }
      
      allItems.push(pluuugItem);
    });
  });
  
  return allItems;
}

/**
 * 캐시 초기화 (필요 시)
 */
export function clearPluuugItemCache(): void {
  pluuugItemCache = null;
}
