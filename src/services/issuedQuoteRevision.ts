import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

// No retry: an interrupted response may already have committed the revision.
export async function saveIssuedQuoteRevision(quoteId: string, expectedUpdatedAt: string, patch: Record<string, unknown>) {
  const { data, error } = await supabase.rpc('save_issued_quote_revision', {
    quote_id: quoteId, expected_updated_at: expectedUpdatedAt, patch: patch as Json,
  });
  if (!error) return data;
  const { data: current, error: readError } = await supabase.from('saved_quotes').select('updated_at').eq('id', quoteId).single();
  if (readError) throw new Error('저장 결과를 확인하지 못했습니다. 편집 내용은 유지됩니다. 다시 저장하지 말고 연결 복구 후 견적과 수정 이력을 확인해 주세요.');
  if (current.updated_at !== expectedUpdatedAt) throw new Error('서버의 견적이 변경되었습니다. 이번 저장이 완료되었거나 다른 사용자가 수정했을 수 있습니다. 편집 내용은 유지됩니다. 새 탭에서 견적과 수정 이력을 확인해 주세요.');
  throw new Error(error.code === 'PGRST202' ? '수정 저장 RPC가 아직 적용되지 않았습니다. 관리자에게 DB 배포를 요청해 주세요.' : `수정 저장 실패: ${error.message}`);
}
