import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

type AmountMode = 'preserve' | 'automatic' | 'manual';
type RevisionResult = {
  id: string;
  updated_at: string;
  version_number: number;
  amount_policy_version: 1;
  subtotal: number;
  tax: number;
  total: number;
  calculation_snapshot: Json;
};

// No retry: an interrupted response may already have committed the revision.
export async function saveIssuedQuoteRevision(quoteId: string, expectedUpdatedAt: string, patch: Record<string, unknown>, amountMode: AmountMode) {
  const requestId = crypto.randomUUID();
  const serverPatch = { ...patch, amount_policy_version: 1, amount_mode: amountMode, request_id: requestId } as Record<string, unknown>;
  delete serverPatch.subtotal;
  delete serverPatch.tax;
  delete serverPatch.total;
  if (amountMode === 'manual') serverPatch.manual_total = patch.total;
  const { data, error } = await supabase.rpc('save_issued_quote_revision', {
    quote_id: quoteId, expected_updated_at: expectedUpdatedAt, patch: serverPatch as Json,
  });
  if (!error) {
    const result = data as unknown as RevisionResult;
    if (result?.id !== quoteId || result.amount_policy_version !== 1 || typeof result.updated_at !== 'string'
      || ![result.subtotal, result.tax, result.total].every(value => typeof value === 'number' && Number.isFinite(value))) {
      throw new Error('서버 저장 응답을 확인하지 못했습니다. 편집 내용은 유지됩니다. 다시 저장하지 말고 새 탭에서 견적과 수정 이력을 확인해 주세요.');
    }
    return result;
  }
  // RLS error details can contain entire rows: log only allowlisted numeric fields.
  let serverDetails: { serverAmountPolicyVersion?: number; expected?: Record<string, number> } = {};
  try {
    const details = JSON.parse(error.details || '{}');
    serverDetails = {
      serverAmountPolicyVersion: typeof details.serverAmountPolicyVersion === 'number' ? details.serverAmountPolicyVersion : undefined,
      expected: Object.fromEntries(['subtotal', 'tax', 'total'].flatMap(key =>
        typeof details.expected?.[key] === 'number' && Number.isFinite(details.expected[key]) ? [[key, details.expected[key]]] : [])),
    };
  } catch { /* Non-amount errors have no safe structured details. */ }
  console.error('Issued quote revision rejected', {
    quoteId, requestId, clientAmountPolicyVersion: 1, code: error.code, ...serverDetails,
    submitted: Object.fromEntries(['subtotal', 'tax', 'total'].flatMap(key =>
      typeof patch[key] === 'number' && Number.isFinite(patch[key]) ? [[key, patch[key]]] : [])),
  });
  const { data: current, error: readError } = await supabase.from('saved_quotes').select('updated_at').eq('id', quoteId).single();
  if (readError) throw new Error('저장 결과를 확인하지 못했습니다. 편집 내용은 유지됩니다. 다시 저장하지 말고 연결 복구 후 견적과 수정 이력을 확인해 주세요.');
  if (current.updated_at !== expectedUpdatedAt) throw new Error('서버의 견적이 변경되었습니다. 이번 저장이 완료되었거나 다른 사용자가 수정했을 수 있습니다. 편집 내용은 유지됩니다. 새 탭에서 견적과 수정 이력을 확인해 주세요.');
  if (error.code === 'PQA02') throw new Error(`${error.message} 편집 내용은 유지됩니다.`);
  if (error.code === 'PGRST202' || (error.code === '22023' && error.message === '허용되지 않은 견적 수정 필드입니다.')) {
    throw new Error('새 금액 저장 규칙이 DB에 아직 적용되지 않았습니다. 편집 내용은 유지됩니다. 관리자에게 DB 배포를 요청해 주세요.');
  }
  throw new Error(`수정 저장 실패: ${error.message} 편집 내용은 유지됩니다. (확인번호: ${requestId})`);
}
