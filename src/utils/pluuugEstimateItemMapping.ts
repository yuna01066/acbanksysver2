/**
 * Pluuug Estimate Item Mapping
 * 
 * 로컬 견적 계산기 항목과 Pluuug 견적서 항목 템플릿 ID 매핑
 * 
 * 로컬 견적서 형식:
 * - 원장 비용: [재질] [두께] [사이즈] [단면/양면] × [수량]장
 * - 가공비: [가공방식] (×배수)
 * - 접착비: [접착방식] (×배수)
 * - 추가옵션: [옵션명] (+금액원)
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

// 로컬 재질명과 표시 이름 매핑
export const LOCAL_QUALITY_DISPLAY_NAMES: Record<string, string> = {
  'glossy-color': '클리어 컬러',
  'glossy-standard': '클리어 스탠다드',
  'satin-color': '브라이트 컬러',
  'astel-color': '아스텔 컬러',
  'acrylic-mirror': '아크릴 미러',
  'astel-mirror': '아스텔 미러',
};

// 로컬 재질(quality)과 Pluuug 항목 ID 매핑 - Pluuug API에서 확인된 실제 ID
export const MATERIAL_TO_PLUUUG_ITEM: Record<string, number> = {
  'glossy-color': 316870,    // Clear 클리어 (Glossy Color) - 확인됨
  'satin-color': 316873,     // Bright 브라이트 (Satin Color) - 확인됨
  'acrylic-mirror': 316874,  // Mirror 미러 (Mirror Acrylic) - 확인됨
  'astel-color': 316872,     // Astel 아스텔 (Astel Color) - 확인됨
  'astel-mirror': 316875,    // Astel Mirror 아스텔 미러 - 확인됨
};

// 로컬 processing_options의 option_id와 Pluuug 항목 정보 매핑
// Pluuug 항목 제목을 로컬과 동일하게 맞춤
export interface PluuugItemMapping {
  pluuugItemId?: number;
  classificationId: number;
  title: string;           // Pluuug에 등록될 제목 (로컬과 동일)
  localTitle: string;      // 로컬 견적서에 표시되는 제목
  unit: string;
  description?: string;    // 상세 설명
}

export const PROCESSING_TO_PLUUUG_ITEM: Record<string, PluuugItemMapping> = {
  // === 원판 구매 (slot1) ===
  'raw-only': {
    pluuugItemId: 317529,
    classificationId: PLUUUG_CLASSIFICATION_IDS.RAW_PURCHASE,
    title: '원판 단독 구매',
    localTitle: '원판 단독 구매',
    unit: '장',
    description: '가공 없이 원판만 구매',
  },
  
  // === 단순 재단 (slot2) ===
  'laser-simple': {
    pluuugItemId: 317530,
    classificationId: PLUUUG_CLASSIFICATION_IDS.SIMPLE_CUTTING,
    title: 'laser-simple',
    localTitle: '레이저 단순 재단',
    unit: 'EA',
    description: '10T 미만 단순 형태 레이저 가공',
  },
  'cnc-simple': {
    pluuugItemId: 317531,
    classificationId: PLUUUG_CLASSIFICATION_IDS.SIMPLE_CUTTING,
    title: 'cnc-simple',
    localTitle: 'CNC 단순 재단',
    unit: 'EA',
    description: '10T 이상 단순 형태 CNC 가공',
  },
  
  // === 복합 재단 (slot3) ===
  'laser-complex': {
    pluuugItemId: 317532,
    classificationId: PLUUUG_CLASSIFICATION_IDS.COMPLEX_CUTTING,
    title: 'laser-complex',
    localTitle: '레이저 복합 재단',
    unit: 'EA',
    description: '10T 미만 복잡한 형태 레이저 가공',
  },
  'cnc-complex': {
    pluuugItemId: 317533,
    classificationId: PLUUUG_CLASSIFICATION_IDS.COMPLEX_CUTTING,
    title: 'cnc-complex',
    localTitle: 'CNC 복합 재단',
    unit: 'EA',
    description: '10T 이상 복잡한 형태 CNC 가공',
  },
  
  // === 전체 재단 (slot4) ===
  'laser-full': {
    pluuugItemId: 317534,
    classificationId: PLUUUG_CLASSIFICATION_IDS.FULL_CUTTING,
    title: 'laser-full',
    localTitle: '레이저 전체 재단',
    unit: 'EA',
    description: '10T 미만 전체 레이저 가공',
  },
  'cnc-full': {
    pluuugItemId: 317535,
    classificationId: PLUUUG_CLASSIFICATION_IDS.FULL_CUTTING,
    title: 'cnc-full',
    localTitle: 'CNC 전체 재단',
    unit: 'EA',
    description: '10T 이상 전체 CNC 가공',
  },
  
  // === 접착면 가공 (slot5) ===
  'cutting-45': {
    pluuugItemId: 317536,
    classificationId: PLUUUG_CLASSIFICATION_IDS.CUTTING_FACE,
    title: '절단면 45°',
    localTitle: '45° 면취 가공',
    unit: 'M',
    description: '45도 각도 면취 가공',
  },
  'cutting-90': {
    pluuugItemId: 317537,
    classificationId: PLUUUG_CLASSIFICATION_IDS.CUTTING_FACE,
    title: '절단면 90°',
    localTitle: '90° 면취 가공',
    unit: 'M',
    description: '90도 직각 면취 가공',
  },
  
  // === 접착 가공 (slot6) ===
  'bond-normal': {
    pluuugItemId: 317538,
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADHESION,
    title: '일반 접착',
    localTitle: '일반 접착',
    unit: 'EA',
    description: '기본 접착 가공',
  },
  'bond-mugipo-auto': {
    pluuugItemId: 317539,
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADHESION,
    title: '무기포 접착 (자동)',
    localTitle: '무기포 접착',
    unit: 'EA',
    description: '45°/90° 중 최적 자동 선택',
  },
  'bond-mugipo-45': {
    pluuugItemId: 317540,
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADHESION,
    title: '무기포 45°',
    localTitle: '무기포 45°',
    unit: 'EA',
    description: '45도 무기포 접착',
  },
  'bond-mugipo-90': {
    pluuugItemId: 317541,
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADHESION,
    title: '무기포 90°',
    localTitle: '무기포 90°',
    unit: 'EA',
    description: '90도 무기포 접착 (프리미엄)',
  },
  
  // === 추가 옵션 (additional) ===
  'edgeFinishing': {
    pluuugItemId: 317542,
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '엣지 경면 (10T 미만)',
    localTitle: '엣지 경면',
    unit: 'EA',
    description: '10T 미만 두께 엣지 경면 마감',
  },
  'edgeFinishing-10': {
    pluuugItemId: 317543,
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '엣지 경면 (10T 이상)',
    localTitle: '엣지 경면',
    unit: 'EA',
    description: '10T 이상 두께 엣지 경면 마감',
  },
  'color-dying-gradient': {
    pluuugItemId: 317544,
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '염색 그라데이션',
    localTitle: '염색 그라데이션',
    unit: 'EA',
    description: '그라데이션 염색 가공',
  },
  'bending': {
    pluuugItemId: 317545,
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '절곡',
    localTitle: '절곡',
    unit: 'EA',
    description: '아크릴 절곡 가공',
  },
  'sanding': {
    pluuugItemId: 317546,
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '샌딩 마감',
    localTitle: '샌딩 마감',
    unit: 'EA',
    description: '표면 샌딩 처리',
  },
  'bulgwang': {
    pluuugItemId: 317547,
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '불광 마감',
    localTitle: '불광 마감',
    unit: 'EA',
    description: '불꽃 광택 마감',
  },
  'mugwangPainting': {
    pluuugItemId: 317548,
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '무광 도장',
    localTitle: '무광 도장',
    unit: 'EA',
    description: '무광 스프레이 도장',
  },
  'tagong': {
    pluuugItemId: 317549,
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '타공',
    localTitle: '타공',
    unit: 'EA',
    description: '구멍 타공 가공',
  },
  'half-tagong': {
    pluuugItemId: 317550,
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '반타공',
    localTitle: '반타공',
    unit: 'EA',
    description: '반만 관통하는 타공',
  },
  'tap-tagong': {
    pluuugItemId: 317551,
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '탭타공',
    localTitle: '탭타공',
    unit: 'EA',
    description: '나사산 탭 가공',
  },
  'drawing-cad': {
    pluuugItemId: 317552,
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '캐드 도면',
    localTitle: 'CAD 도면 작업',
    unit: 'EA',
    description: 'CAD 도면 제작 비용',
  },
  'design-fee': {
    pluuugItemId: 317553,
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '디자인비',
    localTitle: '디자인비',
    unit: 'EA',
    description: '디자인 작업 비용',
  },
  'Quick-delivery-truck': {
    pluuugItemId: 317554,
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '퀵 화물 배송',
    localTitle: '선불 퀵/화물 배송',
    unit: '건',
    description: '긴급 퀵 또는 화물 배송',
  },
  'post-s': {
    pluuugItemId: 317555,
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '택배 배송 S',
    localTitle: '선불 택배 배송 (소)',
    unit: '건',
    description: '소형 택배 배송',
  },
  'post-l': {
    pluuugItemId: 317556,
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '택배 배송 L',
    localTitle: '선불 택배 배송 (대)',
    unit: '건',
    description: '대형 택배 배송',
  },
  'discount': {
    pluuugItemId: 317557,
    classificationId: PLUUUG_CLASSIFICATION_IDS.ADDITIONAL,
    title: '할인',
    localTitle: '할인',
    unit: 'EA',
    description: '할인 적용',
  },
  
  // === 인쇄 가공 ===
  'silkscreen-1': {
    pluuugItemId: 317558,
    classificationId: PLUUUG_CLASSIFICATION_IDS.PRINTING,
    title: '실크 인쇄 1도',
    localTitle: '실크 인쇄 (1도)',
    unit: 'EA',
    description: '1도 실크 스크린 인쇄',
  },
  'uv-backprint': {
    pluuugItemId: 317559,
    classificationId: PLUUUG_CLASSIFICATION_IDS.PRINTING,
    title: 'UV 배면 인쇄',
    localTitle: 'UV 배면 인쇄',
    unit: 'EA',
    description: 'UV 잉크 배면 인쇄',
  },
  
  // === 조색비 ===
  'color-mixing': {
    pluuugItemId: 317560,
    classificationId: PLUUUG_CLASSIFICATION_IDS.COLOR_MIXING,
    title: '조색비',
    localTitle: '조색비',
    unit: '식',
    description: '커스텀 컬러 조색 비용',
  },
  
  // === 미러 증착 ===
  'mirror-coating': {
    pluuugItemId: 317561,
    classificationId: PLUUUG_CLASSIFICATION_IDS.MIRROR_COATING,
    title: '미러 증착',
    localTitle: '미러 증착',
    unit: 'EA',
    description: '미러 코팅 증착 가공',
  },
};


/**
 * 로컬 option_id로 Pluuug 항목 정보 조회
 */
export function getPluuugItemInfo(optionId: string): PluuugItemMapping | null {
  return PROCESSING_TO_PLUUUG_ITEM[optionId] || null;
}

/**
 * 로컬 재질(quality)로 Pluuug 항목 ID 조회
 */
export function getPluuugMaterialItemId(qualityId: string): number | null {
  return MATERIAL_TO_PLUUUG_ITEM[qualityId] || null;
}

/**
 * 로컬 재질(quality) 표시 이름 조회
 */
export function getLocalQualityDisplayName(qualityId: string): string {
  return LOCAL_QUALITY_DISPLAY_NAMES[qualityId] || qualityId;
}

/**
 * 분류 ID로 분류명 조회
 */
export function getCategoryName(classificationId: number): string {
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
 * 견적 breakdown 항목을 Pluuug 견적서 항목 형식으로 변환
 */
export interface PluuugEstimateItem {
  item?: { id: number };  // Pluuug 항목 템플릿 ID (있는 경우)
  title: string;
  quantity: number;
  unitCost: number;
  amount: number;
  unit?: string;
  description?: string;
  order: number;
}

/**
 * 로컬 breakdown 라벨에서 가공 옵션 ID 추출
 */
function matchBreakdownLabelToOptionId(label: string): string | null {
  const normalizedLabel = label.replace(/\s/g, '').toLowerCase();
  
  for (const [optionId, info] of Object.entries(PROCESSING_TO_PLUUUG_ITEM)) {
    const normalizedTitle = info.title.replace(/\s/g, '').toLowerCase();
    const normalizedLocalTitle = info.localTitle.replace(/\s/g, '').toLowerCase();
    
    if (
      normalizedLabel.includes(normalizedTitle) || 
      normalizedLabel.includes(normalizedLocalTitle) ||
      normalizedTitle.includes(normalizedLabel) ||
      normalizedLocalTitle.includes(normalizedLabel)
    ) {
      return optionId;
    }
  }
  return null;
}

/**
 * 로컬 견적 breakdown을 Pluuug 형식으로 변환
 * 로컬 형식 그대로 유지하면서 Pluuug item ID 매핑
 */
export function convertBreakdownToPluuugItems(
  breakdown: Array<{ label: string; price: number }>,
  qualityId: string,
  processingOptions: string[],
  quantity: number = 1
): PluuugEstimateItem[] {
  const items: PluuugEstimateItem[] = [];
  let order = 1;
  
  breakdown.forEach(item => {
    const pluuugItem: PluuugEstimateItem = {
      title: item.label, // 로컬 라벨 그대로 사용
      quantity: quantity,
      unitCost: Math.round(item.price / quantity),
      amount: item.price,
      order: order++,
    };
    
    // 원장/판재 비용인지 확인
    if (item.label.includes('원장') || item.label.includes('판재')) {
      const materialItemId = getPluuugMaterialItemId(qualityId);
      if (materialItemId) {
        pluuugItem.item = { id: materialItemId };
      }
      pluuugItem.unit = '장';
      pluuugItem.description = `재질: ${getLocalQualityDisplayName(qualityId)}`;
    } else {
      // 가공 옵션 매칭
      const matchedOptionId = matchBreakdownLabelToOptionId(item.label);
      if (matchedOptionId) {
        const optionInfo = PROCESSING_TO_PLUUUG_ITEM[matchedOptionId];
        if (optionInfo) {
          if (optionInfo.pluuugItemId) {
            pluuugItem.item = { id: optionInfo.pluuugItemId };
          }
          pluuugItem.unit = optionInfo.unit;
          pluuugItem.description = `분류: ${getCategoryName(optionInfo.classificationId)}`;
        }
      }
      
      // 선택된 가공 옵션에서 직접 매칭
      for (const optionId of processingOptions) {
        const optionInfo = PROCESSING_TO_PLUUUG_ITEM[optionId];
        if (optionInfo) {
          const normalizedLabel = item.label.replace(/\s/g, '').toLowerCase();
          const normalizedTitle = optionInfo.title.replace(/\s/g, '').toLowerCase();
          const normalizedLocalTitle = optionInfo.localTitle.replace(/\s/g, '').toLowerCase();
          
          if (
            normalizedLabel.includes(normalizedTitle) || 
            normalizedLabel.includes(normalizedLocalTitle)
          ) {
            if (optionInfo.pluuugItemId) {
              pluuugItem.item = { id: optionInfo.pluuugItemId };
            }
            pluuugItem.unit = optionInfo.unit;
            pluuugItem.description = optionInfo.description || `분류: ${getCategoryName(optionInfo.classificationId)}`;
            break;
          }
        }
      }
    }
    
    items.push(pluuugItem);
  });
  
  return items;
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
    thickness?: string;
    size?: string;
    surface?: string;
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
      
      // 원장/판재 항목 매칭
      if (item.label.includes('원장') || item.label.includes('판재')) {
        const materialItemId = getPluuugMaterialItemId(quote.quality);
        if (materialItemId) {
          pluuugItem.item = { id: materialItemId };
        }
        pluuugItem.unit = '장';
        
        // 상세 설명 생성
        const details: string[] = [];
        details.push(`재질: ${getLocalQualityDisplayName(quote.quality)}`);
        if (quote.thickness) details.push(`두께: ${quote.thickness}`);
        if (quote.size) details.push(`사이즈: ${quote.size}`);
        if (quote.surface) details.push(`면: ${quote.surface}`);
        pluuugItem.description = details.join(' | ');
      } else {
        // 가공 옵션 매칭
        for (const optionId of processingOptions) {
          const optionInfo = PROCESSING_TO_PLUUUG_ITEM[optionId];
          if (optionInfo) {
            const normalizedLabel = item.label.replace(/\s/g, '').toLowerCase();
            const normalizedTitle = optionInfo.title.replace(/\s/g, '').toLowerCase();
            const normalizedLocalTitle = optionInfo.localTitle.replace(/\s/g, '').toLowerCase();
            
            if (
              normalizedLabel.includes(normalizedTitle) || 
              normalizedLabel.includes(normalizedLocalTitle) ||
              normalizedTitle.includes(normalizedLabel) ||
              normalizedLocalTitle.includes(normalizedLabel)
            ) {
              if (optionInfo.pluuugItemId) {
                pluuugItem.item = { id: optionInfo.pluuugItemId };
              }
              pluuugItem.unit = optionInfo.unit;
              break;
            }
          }
        }
      }
      
      allItems.push(pluuugItem);
    });
  });
  
  return allItems;
}

/**
 * Pluuug 항목을 로컬 형식으로 업데이트하기 위한 페이로드 생성
 */
export function createPluuugItemUpdatePayload(
  optionId: string
): {
  title: string;
  unit: string;
  description: string;
  classification: { id: number };
} | null {
  const mapping = PROCESSING_TO_PLUUUG_ITEM[optionId];
  if (!mapping) return null;
  
  return {
    title: mapping.title,
    unit: mapping.unit,
    description: mapping.description || `로컬 옵션: ${optionId}`,
    classification: { id: mapping.classificationId },
  };
}

/**
 * 모든 로컬 옵션에 대한 Pluuug 업데이트 페이로드 목록 생성
 */
export function getAllPluuugItemUpdatePayloads(): Array<{
  optionId: string;
  payload: {
    title: string;
    unit: string;
    description: string;
    classification: { id: number };
  };
}> {
  const payloads: Array<{
    optionId: string;
    payload: {
      title: string;
      unit: string;
      description: string;
      classification: { id: number };
    };
  }> = [];
  
  for (const [optionId, mapping] of Object.entries(PROCESSING_TO_PLUUUG_ITEM)) {
    payloads.push({
      optionId,
      payload: {
        title: mapping.title,
        unit: mapping.unit,
        description: mapping.description || `로컬 옵션: ${optionId}`,
        classification: { id: mapping.classificationId },
      },
    });
  }
  
  return payloads;
}

/**
 * 동적으로 Pluuug 항목 ID 캐시
 */
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
 * 캐시 초기화 (필요 시)
 */
export function clearPluuugItemCache(): void {
  pluuugItemCache = null;
}
