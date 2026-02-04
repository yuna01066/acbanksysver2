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
      classificationId: item.classification?.id || 0
    }));

    // 로컬 옵션과 매칭
    items.forEach(item => {
      for (const [optionId, optionInfo] of Object.entries(PROCESSING_TO_PLUUUG_ITEM)) {
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

    // 선택된 가공 옵션에서 매칭되는 Pluuug item ID 찾기
    for (const optionId of selectedOptions) {
      const optionInfo = PROCESSING_TO_PLUUUG_ITEM[optionId];
      if (optionInfo && optionInfo.pluuugItemId) {
        // 라벨에 옵션 이름이 포함되어 있는지 확인
        const normalizedLabel = item.label.replace(/\s/g, '').toLowerCase();
        const normalizedTitle = optionInfo.title.replace(/\s/g, '').toLowerCase();
        
        if (normalizedLabel.includes(normalizedTitle) || normalizedTitle.includes(normalizedLabel)) {
          mappedItem.item = { id: optionInfo.pluuugItemId };
          mappedItem.description = `분류: ${getCategoryName(optionInfo.classificationId)}`;
          break;
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
      lines.push(`'${item.localOptionId}': {`);
      lines.push(`  pluuugItemId: ${item.id},`);
      lines.push(`  classificationId: ${item.classificationId},`);
      lines.push(`  title: '${item.title}',`);
      lines.push(`  unit: '${item.unit}',`);
      lines.push('},');
    }
  });
  
  return lines.join('\n');
}
