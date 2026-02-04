/**
 * Pluuug Estimate Item 동기화 유틸리티
 * 
 * 로컬 견적 항목을 Pluuug estimate.item 템플릿으로 등록하고 관리합니다.
 * Pluuug 항목을 로컬 형식과 동일하게 맞춥니다.
 */

import { supabase } from '@/integrations/supabase/client';
import { 
  PLUUUG_CLASSIFICATION_IDS,
  PROCESSING_TO_PLUUUG_ITEM,
  LOCAL_QUALITY_DISPLAY_NAMES,
  MATERIAL_TO_PLUUUG_ITEM,
  getCategoryName,
  type PluuugItemMapping
} from './pluuugEstimateItemMapping';

// 로컬 가공 옵션을 Pluuug estimate.item 형식으로 변환
export interface EstimateItemCreatePayload {
  title: string;
  description?: string;
  unit: string;
  unitCost?: string;
  classification: { id: number };
}

// Pluuug에서 등록된 항목 정보
export interface RegisteredEstimateItem {
  id: number;
  title: string;
  unit: string;
  description?: string;
  classificationId: number;
  localOptionId?: string;
}

// 로컬 옵션 정보 (UI 표시용)
export interface LocalOptionInfo {
  optionId: string;
  title: string;
  localTitle: string;
  unit: string;
  description?: string;
  classificationId: number;
  classificationName: string;
  pluuugItemId?: number;
  isMapped: boolean;
}

/**
 * 모든 로컬 옵션 정보 조회
 */
export function getAllLocalOptions(): LocalOptionInfo[] {
  return Object.entries(PROCESSING_TO_PLUUUG_ITEM).map(([optionId, info]) => ({
    optionId,
    title: info.title,
    localTitle: info.localTitle,
    unit: info.unit,
    description: info.description,
    classificationId: info.classificationId,
    classificationName: getCategoryName(info.classificationId),
    pluuugItemId: info.pluuugItemId,
    isMapped: !!info.pluuugItemId
  }));
}

/**
 * 로컬 재질 옵션 정보 조회
 */
export function getLocalMaterialOptions(): Array<{
  qualityId: string;
  displayName: string;
  pluuugItemId: number;
}> {
  return Object.entries(MATERIAL_TO_PLUUUG_ITEM).map(([qualityId, pluuugItemId]) => ({
    qualityId,
    displayName: LOCAL_QUALITY_DISPLAY_NAMES[qualityId] || qualityId,
    pluuugItemId
  }));
}

/**
 * 로컬 가공 옵션을 Pluuug estimate.item으로 변환
 * 로컬 형식과 동일한 제목 및 설명 사용
 */
export function convertLocalOptionToEstimateItem(
  optionId: string,
  optionInfo: PluuugItemMapping
): EstimateItemCreatePayload {
  return {
    title: optionInfo.title,
    description: optionInfo.description || `로컬 옵션 ID: ${optionId}`,
    unit: optionInfo.unit,
    unitCost: '0.00',
    classification: { id: optionInfo.classificationId }
  };
}

/**
 * 모든 로컬 가공 옵션을 Pluuug에 일괄 등록
 */
export async function registerAllLocalOptionsToPlluug(): Promise<{
  success: boolean;
  registered: RegisteredEstimateItem[];
  skipped: string[];
  errors: { optionId: string; error: string }[];
}> {
  const registered: RegisteredEstimateItem[] = [];
  const skipped: string[] = [];
  const errors: { optionId: string; error: string }[] = [];

  const entries = Object.entries(PROCESSING_TO_PLUUUG_ITEM);

  for (const [optionId, optionInfo] of entries) {
    // 이미 Pluuug ID가 있는 항목은 스킵
    if (optionInfo.pluuugItemId) {
      skipped.push(optionId);
      continue;
    }

    try {
      const payload = convertLocalOptionToEstimateItem(optionId, optionInfo);
      
      const { data, error } = await supabase.functions.invoke('pluuug-api', {
        body: {
          action: 'estimate.item.create',
          data: payload
        }
      });

      if (error) {
        errors.push({ optionId, error: error.message });
        continue;
      }

      if (data?.error) {
        errors.push({ optionId, error: data.error });
        continue;
      }

      if (data?.data?.id) {
        registered.push({
          id: data.data.id,
          title: optionInfo.title,
          unit: optionInfo.unit,
          classificationId: optionInfo.classificationId,
          localOptionId: optionId
        });
        console.log(`[Pluuug Item Sync] Registered: ${optionId} -> ${data.data.id}`);
      }
    } catch (err: any) {
      errors.push({ optionId, error: err.message });
    }
  }

  return {
    success: errors.length === 0,
    registered,
    skipped,
    errors
  };
}

/**
 * 특정 로컬 옵션을 Pluuug에 등록
 */
export async function registerSingleOptionToPluuug(
  optionId: string
): Promise<{ success: boolean; pluuugItemId?: number; error?: string }> {
  const optionInfo = PROCESSING_TO_PLUUUG_ITEM[optionId];
  
  if (!optionInfo) {
    return { success: false, error: `옵션을 찾을 수 없습니다: ${optionId}` };
  }

  if (optionInfo.pluuugItemId) {
    return { success: true, pluuugItemId: optionInfo.pluuugItemId };
  }

  try {
    const payload = convertLocalOptionToEstimateItem(optionId, optionInfo);
    
    const { data, error } = await supabase.functions.invoke('pluuug-api', {
      body: {
        action: 'estimate.item.create',
        data: payload
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { 
      success: true, 
      pluuugItemId: data?.data?.id 
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Pluuug estimate.item 업데이트
 */
export async function updatePluuugEstimateItem(
  itemId: number,
  updates: Partial<EstimateItemCreatePayload>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('pluuug-api', {
      body: {
        action: 'estimate.item.update',
        id: itemId,
        data: updates
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Pluuug 항목을 로컬 형식으로 일괄 업데이트
 * 기존 Pluuug 항목의 제목, 단위, 설명을 로컬 형식으로 동기화
 */
export async function syncLocalFormatToPluuug(): Promise<{
  success: boolean;
  updated: { optionId: string; pluuugItemId: number; title: string }[];
  skipped: string[];
  errors: { optionId: string; error: string }[];
}> {
  const updated: { optionId: string; pluuugItemId: number; title: string }[] = [];
  const skipped: string[] = [];
  const errors: { optionId: string; error: string }[] = [];

  const entries = Object.entries(PROCESSING_TO_PLUUUG_ITEM);

  for (const [optionId, optionInfo] of entries) {
    // Pluuug ID가 없는 항목은 스킵 (등록되지 않은 항목)
    if (!optionInfo.pluuugItemId) {
      skipped.push(optionId);
      continue;
    }

    try {
      const updatePayload: EstimateItemCreatePayload = {
        title: optionInfo.title,
        description: optionInfo.description || `분류: ${getCategoryName(optionInfo.classificationId)}`,
        unit: optionInfo.unit,
        classification: { id: optionInfo.classificationId }
      };
      
      const { data, error } = await supabase.functions.invoke('pluuug-api', {
        body: {
          action: 'estimate.item.update',
          id: optionInfo.pluuugItemId,
          data: updatePayload
        }
      });

      if (error) {
        errors.push({ optionId, error: error.message });
        continue;
      }

      if (data?.error) {
        errors.push({ optionId, error: data.error });
        continue;
      }

      updated.push({
        optionId,
        pluuugItemId: optionInfo.pluuugItemId,
        title: optionInfo.title
      });
      console.log(`[Pluuug Format Sync] Updated: ${optionId} (ID: ${optionInfo.pluuugItemId}) -> ${optionInfo.title}`);
    } catch (err: any) {
      errors.push({ optionId, error: err.message });
    }
  }

  return {
    success: errors.length === 0,
    updated,
    skipped,
    errors
  };
}

/**
 * Pluuug에서 estimate.item 목록 조회 후 로컬 매핑과 동기화
 */
export async function syncEstimateItemsFromPluuug(): Promise<{
  success: boolean;
  items: RegisteredEstimateItem[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('pluuug-api', {
      body: { action: 'estimate.item.list' }
    });

    if (error) {
      return { success: false, items: [], error: error.message };
    }

    if (data?.error) {
      return { success: false, items: [], error: data.error };
    }

    const items: RegisteredEstimateItem[] = (data?.data?.results || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      unit: item.unit,
      description: item.description,
      classificationId: item.classification?.id || 0
    }));

    // 로컬 옵션과 매칭
    items.forEach(item => {
      for (const [optionId, optionInfo] of Object.entries(PROCESSING_TO_PLUUUG_ITEM)) {
        // ID 매칭 우선
        if (optionInfo.pluuugItemId === item.id) {
          item.localOptionId = optionId;
          break;
        }
        // 제목 + 분류 매칭
        if (optionInfo.title === item.title && optionInfo.classificationId === item.classificationId) {
          item.localOptionId = optionId;
          break;
        }
      }
    });

    return { success: true, items };
  } catch (err: any) {
    return { success: false, items: [], error: err.message };
  }
}

/**
 * 견적서 breakdown 항목에 Pluuug item ID 매핑 생성
 * 로컬 견적서 형식 -> Pluuug 견적서 형식 변환
 */
export function mapBreakdownToEstimateItems(
  breakdown: Array<{ label: string; price: number }>,
  qualityId: string,
  selectedOptions: string[],
  quantity: number = 1
): Array<{
  item?: { id: number };
  title: string;
  quantity: number;
  unitCost: number;
  amount: number;
  description?: string;
  order: number;
}> {
  const result: Array<{
    item?: { id: number };
    title: string;
    quantity: number;
    unitCost: number;
    amount: number;
    description?: string;
    order: number;
  }> = [];

  let order = 1;

  breakdown.forEach(item => {
    const mappedItem: typeof result[0] = {
      title: item.label,
      quantity: quantity,
      unitCost: Math.round(item.price / quantity),
      amount: item.price,
      order: order++
    };

    // 원장/판재 비용인 경우 재질 ID 매핑
    if (item.label.includes('원장') || item.label.includes('판재')) {
      const materialItemId = MATERIAL_TO_PLUUUG_ITEM[qualityId];
      if (materialItemId) {
        mappedItem.item = { id: materialItemId };
        mappedItem.description = `재질: ${LOCAL_QUALITY_DISPLAY_NAMES[qualityId] || qualityId}`;
      }
    } else {
      // 선택된 가공 옵션에서 매칭되는 Pluuug item ID 찾기
      for (const optionId of selectedOptions) {
        const optionInfo = PROCESSING_TO_PLUUUG_ITEM[optionId];
        if (optionInfo && optionInfo.pluuugItemId) {
          // 라벨에 옵션 이름이 포함되어 있는지 확인
          const normalizedLabel = item.label.replace(/\s/g, '').toLowerCase();
          const normalizedTitle = optionInfo.title.replace(/\s/g, '').toLowerCase();
          const normalizedLocalTitle = optionInfo.localTitle.replace(/\s/g, '').toLowerCase();
          
          if (
            normalizedLabel.includes(normalizedTitle) || 
            normalizedLabel.includes(normalizedLocalTitle) ||
            normalizedTitle.includes(normalizedLabel) ||
            normalizedLocalTitle.includes(normalizedLabel)
          ) {
            mappedItem.item = { id: optionInfo.pluuugItemId };
            mappedItem.description = `분류: ${getCategoryName(optionInfo.classificationId)}`;
            break;
          }
        }
      }
    }

    result.push(mappedItem);
  });

  return result;
}

/**
 * 로컬 매핑 테이블 업데이트를 위한 코드 생성
 * (개발 시 콘솔에서 복사하여 사용)
 */
export function generateMappingCodeUpdate(items: RegisteredEstimateItem[]): string {
  const lines: string[] = [];
  
  lines.push('// 자동 생성된 Pluuug Item ID 매핑 업데이트');
  lines.push('// 아래 코드를 pluuugEstimateItemMapping.ts에 추가하세요\n');
  
  items.forEach(item => {
    if (item.localOptionId) {
      const localInfo = PROCESSING_TO_PLUUUG_ITEM[item.localOptionId];
      lines.push(`'${item.localOptionId}': {`);
      lines.push(`  pluuugItemId: ${item.id},`);
      lines.push(`  classificationId: ${item.classificationId},`);
      lines.push(`  title: '${item.title}',`);
      lines.push(`  localTitle: '${localInfo?.localTitle || item.title}',`);
      lines.push(`  unit: '${item.unit}',`);
      lines.push(`  description: '${item.description || ''}',`);
      lines.push('},');
    }
  });
  
  return lines.join('\n');
}

/**
 * 로컬 형식 미리보기 생성
 */
export function getLocalFormatPreview(): Array<{
  category: string;
  items: Array<{
    optionId: string;
    title: string;
    localTitle: string;
    unit: string;
    description: string;
    hasPluuugId: boolean;
  }>;
}> {
  const categories: Record<number, Array<{
    optionId: string;
    title: string;
    localTitle: string;
    unit: string;
    description: string;
    hasPluuugId: boolean;
  }>> = {};

  Object.entries(PROCESSING_TO_PLUUUG_ITEM).forEach(([optionId, info]) => {
    if (!categories[info.classificationId]) {
      categories[info.classificationId] = [];
    }
    categories[info.classificationId].push({
      optionId,
      title: info.title,
      localTitle: info.localTitle,
      unit: info.unit,
      description: info.description || '',
      hasPluuugId: !!info.pluuugItemId
    });
  });

  return Object.entries(categories).map(([classId, items]) => ({
    category: getCategoryName(parseInt(classId)),
    items
  }));
}
